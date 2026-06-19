'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Check, X, Calendar, AlertCircle, Sparkles, Plus, Trash2, SlidersHorizontal, RefreshCw, Info, Shuffle, GripVertical, ListOrdered, Lock, Layers } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { teamColor } from '@/lib/team-color';
import { Division, Team, Venue, PlayoffConfig, PlayoffTierConfig, Tournament, Game } from '@/lib/types';
import { formatPoolName } from '@/lib/utils';
import { resolveManualTravelBuffers } from '@/lib/schedule-metrics';
import { buildBracketScheduleMetrics } from '@/lib/bracket-schedule-metrics';
import { resolveGameTiming } from '@/lib/schedule-conflict';
import NumberStepper from '@/components/admin/NumberStepper';
import {
  filterStartsAfterRoundRobinCompletion,
  getRoundRobinCompletion,
  startsBeforeRoundRobinCompletion,
} from '@/lib/playoff-scheduling-guard';
import {
  defaultSchedulePriorities,
  generateScoredSchedule,
  type ScheduleDraftMatchup,
  type ScheduleDraftAssignment,
  type ScheduleDraftParticipant,
  type ScheduleDraftSlot,
  type SchedulePrioritySettings,
} from '@/lib/schedule-generator';
import { generateBracket, nextPow2, ordinal, remapTierSeed, suggestDefaultTiers, validateTierRanges } from '@/lib/playoff-bracket';
import { isPlayoffOnly as resolveIsPlayoffOnly } from '@/lib/tournament-phase';
import BracketColumns, { buildBracketColumns } from './components/BracketColumns';
import BracketHealthPanel from './components/BracketHealthPanel';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './schedule-admin.module.css';

interface Props {
  divisions: Division[];
  /** Division to open on; falls back to the first division. */
  defaultDivisionId?: string;
  tournamentId: string;
  tournament?: Tournament | null;
  orgSlug?: string;
  /**
   * Whether this org can use the auto-schedule optimizer + tiered auto-split
   * (the `auto_schedule`/`playoff_generator` Plus features). Free tier can still
   * build the bracket structure and set dates/times/venues by hand.
   */
  canAutoSchedule?: boolean;
  /**
   * Optional config overrides merged into the opened division's defaults — used
   * by the "Start from standings" entry point to pre-set a simple single-elim
   * baseline (1 v 8, 2 v 7 …). Cleared on a real division switch.
   */
  initialConfig?: Partial<PlayoffConfig>;
  onClose: () => void;
  onComplete: () => void;
}

function initialPlayoffConfig(division: Division): PlayoffConfig {
  const defaults: PlayoffConfig = {
    type: 'single',
    format: 'single',
    grandFinalReset: true,
    crossover: 'standard',
    hasThirdPlace: false,
    teamsQualifying: 4,
    tieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  };
  const merged = { ...defaults, ...(division.playoffConfig || {}) };
  // Standard crossover requires exactly 2 pools; otherwise fall back to reseed.
  return merged.crossover === 'standard' && (division.pools?.length || 0) !== 2
    ? { ...merged, crossover: 'reseed' }
    : merged;
}

interface DateSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface ScheduleResource {
  key: string;
  venueId: string;
  venueName: string;
  venueFacilityId?: string | null;
  label: string;
}

interface PlayoffPreviewRow {
  round: string;
  pool?: string;
  home: string;
  away: string;
  code: string;
  date: string;
  time: string;
  venueId: string;
  venueFacilityId?: string;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
  location?: string;
  sourceGameId?: string;
}

interface FacilityLaneEnsureRow {
  id: string;
  label: string;
}

interface DraftOptimizationSummary {
  score: number;
  healthScore: number;
  candidateCount: number;
}

type PlayoffTemplateGame = Pick<PlayoffPreviewRow, 'round' | 'home' | 'away' | 'code'> & Partial<Pick<PlayoffPreviewRow, 'pool'>>;
type GenerationScope = 'replace' | 'build';

const EFFORT_DESCRIPTIONS: Record<number, string> = {
  12: 'Fast checks fewer drafts and returns quicker.',
  24: 'Balanced checks more drafts without making generation feel slow.',
  40: 'Deep checks the most drafts for tougher brackets.',
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

const SEED_ORDINALS = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
function ordinalLabel(rank: number) {
  return `${rank}${SEED_ORDINALS[rank - 1] || 'th'}`;
}

/**
 * Ordered seed labels for a single-bracket seeding mode (length = teamsQualifying).
 * Standard crossover (2 pools) interleaves pools by rank so pool winners are the
 * top, separated seeds ([1A, 1B, 2A, 2B, …]); everything else is a global reseed
 * ([Seed #1 … Seed #N]). The unified bracket engine maps `Seed #k` -> labels[k-1].
 */
function buildSeedLabels(config: PlayoffConfig, pools: { name: string }[]): string[] {
  const n = config.teamsQualifying;
  if (config.crossover === 'standard' && pools.length === 2) {
    const perPool = Math.ceil(n / pools.length);
    const labels: string[] = [];
    for (let r = 1; r <= perPool; r++) {
      for (const pool of pools) labels.push(`${ordinalLabel(r)} Pool ${pool.name}`);
    }
    return labels.slice(0, n);
  }
  return Array.from({ length: n }, (_, i) => `Seed #${i + 1}`);
}

/** Replace a `Seed #k` reference with its seeding-mode label; pass other refs through. */
function remapSeedRef(ref: string, labels: string[]): string {
  const m = ref.match(/^Seed #(\d+)$/);
  if (!m) return ref;
  return labels[Number(m[1]) - 1] ?? ref;
}

/** Order teams by the seed numbers assigned in the Teams admin (1 = top seed);
 *  unseeded teams sort last, by name. */
function orderBySeed(list: Team[]): Team[] {
  return [...list].sort((a, b) => {
    const as = typeof a.seed === 'number' ? a.seed : Number.POSITIVE_INFINITY;
    const bs = typeof b.seed === 'number' ? b.seed : Number.POSITIVE_INFINITY;
    return as - bs || (a.name || '').localeCompare(b.name || '');
  });
}

/** A draggable seed row (playoff-only manual seeding). */
function SortableSeed({ id, seed, teamName, isBye }: { id: string; seed: number; teamName: string; isBye: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.5rem 0.65rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '2px',
    ...(isDragging ? { zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' } : {}),
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--white-40)', display: 'flex', touchAction: 'none' }}>
        <GripVertical size={14} />
      </div>
      <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--logic-lime)', minWidth: '1.5rem', textAlign: 'center' }}>
        {seed}
      </span>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor(teamName), flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{teamName}</span>
      {isBye && (
        <span className="badge badge-neutral" style={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>BYE R1</span>
      )}
    </div>
  );
}

export default function PlayoffWizard({ divisions, defaultDivisionId, tournamentId, tournament = null, orgSlug, canAutoSchedule = true, initialConfig, onClose, onComplete }: Props) {
  const [selectedDivisionId, setSelectedDivisionId] = useState(() => defaultDivisionId ?? divisions[0]?.id ?? '');
  const division = useMemo(
    () => (divisions.find(d => d.id === selectedDivisionId) ?? divisions[0]) as Division,
    [divisions, selectedDivisionId],
  );
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [feedback, setFeedback] = useState<{isOpen: boolean; title: string; message: string; type: 'primary'|'danger'|'warning'|'success'|'info'}>({isOpen: false, title: '', message: '', type: 'primary'});
  const [config, setConfig] = useState<PlayoffConfig>(() => ({ ...initialPlayoffConfig(division), ...(initialConfig ?? {}) }));
  const lastDivisionId = useRef(selectedDivisionId);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [existingGames, setExistingGames] = useState<Game[]>([]);
  const [preview, setPreview] = useState<PlayoffPreviewRow[]>([]);
  const [templatePreview, setTemplatePreview] = useState<PlayoffPreviewRow[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  // Backdrop-close guard: only close when a click both STARTS and ENDS on the
  // overlay itself. Native <input type="date|time"> picker popups render outside
  // the modal DOM, so selecting a value used to land a click on the overlay and
  // close the whole wizard mid-edit. Tracking the mousedown target prevents that.
  const overlayMouseDownRef = useRef(false);
  const [showWarning, setShowWarning] = useState(false);
  // Free tier (no auto_schedule entitlement) defaults to manual bracket building;
  // the auto-schedule optimizer toggle is locked below.
  const [autoSchedule, setAutoSchedule] = useState(canAutoSchedule);
  const [generationScope, setGenerationScope] = useState<GenerationScope>('replace');
  const [gameLength, setGameLength] = useState(tournament?.settings?.game_duration_minutes ?? 90);
  const [breakLength, setBreakLength] = useState(tournament?.settings?.buffer_minutes ?? 15);
  const [dateSlots, setDateSlots] = useState<DateSlot[]>([
    { date: tournament?.endDate || tournament?.startDate || '', startTime: '09:00', endTime: '20:30' },
  ]);
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(new Set());
  const [temporaryFacilityCount, setTemporaryFacilityCount] = useState(2);
  const [priorities, setPriorities] = useState<SchedulePrioritySettings>(() => defaultSchedulePriorities());
  const [draftSummary, setDraftSummary] = useState<DraftOptimizationSummary | null>(null);
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => r.ok ? r.json() : []),
    ]).then(([ds, all, games]) => {
      const venueRows = ds as Venue[];
      setVenues(venueRows);
      setSelectedResourceKeys(current => (
        current.size > 0 ? current : new Set(venueRows.flatMap(getVenueResourceKeys))
      ));
      setTeams((all as Team[]).filter(t => t.divisionId === division.id && t.status === 'accepted'));
      setExistingGames((games as Game[]).filter(game => game.divisionId === division.id));
    });
  }, [tournamentId, division.id, orgParam]);

  // Switching the division resets the bracket config to that division's defaults
  // and clears any in-progress preview. Only fires on a real division change.
  useEffect(() => {
    if (lastDivisionId.current === selectedDivisionId) return;
    lastDivisionId.current = selectedDivisionId;
    const next = divisions.find(d => d.id === selectedDivisionId) ?? divisions[0];
    if (!next) return;
    // Reset to the new division's defaults, then re-apply the entry-point preset
    // (e.g. "Start from standings" → single-elim/reseed) so it survives a switch.
    setConfig({ ...initialPlayoffConfig(next), ...(initialConfig ?? {}) });
    setPreview([]);
    setTemplatePreview([]);
    setDraftSummary(null);
  }, [selectedDivisionId, divisions, initialConfig]);

  // ── Playoff-only (bracket-first) seeding ───────────────────────────────────
  const isPlayoffOnly = useMemo(() => resolveIsPlayoffOnly(tournament), [tournament]);
  const [seededTeams, setSeededTeams] = useState<Team[]>([]);
  const [protectTopSeeds, setProtectTopSeeds] = useState(0);
  const seedSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const seedByeCount = Math.max(0, nextPow2(seededTeams.length) - seededTeams.length);

  // Show real team names (not "Seed #N") in the bracket canvas for playoff-only.
  const seedLabelFor = useMemo<((raw: string) => string) | undefined>(() => {
    if (!isPlayoffOnly) return undefined;
    return (raw: string) => {
      const m = raw.match(/^Seed #(\d+)$/);
      if (!m) return raw;
      return seededTeams[Number(m[1]) - 1]?.name ?? raw;
    };
  }, [isPlayoffOnly, seededTeams]);

  // The seed list mirrors the division's accepted teams. Preserve the admin's
  // manual order while the team set is unchanged; reset it when the set changes
  // (e.g. switching divisions or new accepted teams).
  useEffect(() => {
    setSeededTeams(prev => {
      const prevIds = new Set(prev.map(t => t.id));
      const sameSet = prev.length === teams.length && teams.every(t => prevIds.has(t.id));
      if (sameSet) return prev;
      // If the organizer has assigned seed numbers in the Teams admin, start in
      // that order; otherwise keep the incoming (name) order.
      return teams.some(t => typeof t.seed === 'number') ? orderBySeed(teams) : teams;
    });
  }, [teams]);

  // Playoff-only brackets seed directly from the ordered team list (no pools):
  // bracket size = number of seeded teams, seeded as a global reseed — UNLESS the
  // organizer has switched to Tiered Brackets, which keeps its own crossover and
  // only syncs the qualifying count to the seed list.
  useEffect(() => {
    if (!isPlayoffOnly) return;
    setConfig(c => {
      if (c.crossover === 'tiers') {
        return c.teamsQualifying === seededTeams.length ? c : { ...c, teamsQualifying: seededTeams.length };
      }
      return c.crossover === 'reseed' && c.teamsQualifying === seededTeams.length
        ? c
        : { ...c, crossover: 'reseed', teamsQualifying: seededTeams.length };
    });
  }, [isPlayoffOnly, seededTeams.length]);

  // Eligible team count for tiered splitting: seeded list (playoff-only) or all
  // accepted teams (round robin — standings rank all of them).
  const tierEligibleCount = isPlayoffOnly ? seededTeams.length : teams.length;

  // When Tiered Brackets is selected but not yet configured, seed a sensible
  // default split (two equal-ish contiguous tiers) sized to the eligible count.
  useEffect(() => {
    if (config.crossover !== 'tiers') return;
    if ((config.tierConfigs?.length ?? 0) > 0) return;
    const suggested = suggestDefaultTiers(tierEligibleCount);
    if (suggested.length === 0) return;
    setConfig(c => ({ ...c, tierConfigs: suggested, teamsQualifying: Math.max(...suggested.map(t => t.toSeed)) }));
  }, [config.crossover, config.tierConfigs, tierEligibleCount]);

  // ── Tier editing helpers ───────────────────────────────────────────────────
  const tierConfigs = config.tierConfigs ?? [];
  const tierValidation = useMemo(
    () => validateTierRanges(tierConfigs, tierEligibleCount),
    [tierConfigs, tierEligibleCount],
  );

  /** Commit a new tier list, re-deriving contiguity (each tier starts after the
   *  previous one ends) and keeping teamsQualifying = highest covered seed. */
  function commitTiers(next: PlayoffTierConfig[]) {
    let prev = 0;
    const normalized = next.map(t => {
      const fromSeed = prev + 1;
      const toSeed = Math.max(fromSeed + 1, t.toSeed);
      prev = toSeed;
      return { ...t, fromSeed, toSeed };
    });
    setConfig(c => ({
      ...c,
      tierConfigs: normalized,
      teamsQualifying: normalized.length ? Math.max(...normalized.map(t => t.toSeed)) : c.teamsQualifying,
    }));
    clearSeedPreview();
  }

  function updateTier(idx: number, updates: Partial<PlayoffTierConfig>) {
    commitTiers(tierConfigs.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  }

  function addTier() {
    const last = tierConfigs[tierConfigs.length - 1];
    const start = last ? last.toSeed + 1 : 1;
    commitTiers([
      ...tierConfigs,
      { name: `Tier ${tierConfigs.length + 1}`, fromSeed: start, toSeed: start + 1, format: config.format ?? 'single' },
    ]);
  }

  function removeTier(idx: number) {
    if (tierConfigs.length <= 1) return;
    commitTiers(tierConfigs.filter((_, i) => i !== idx));
  }

  function clearSeedPreview() {
    setTemplatePreview([]);
    setPreview([]);
    setDraftSummary(null);
  }

  function randomizeSeeds() {
    setSeededTeams(prev => {
      const keep = Math.max(0, Math.min(protectTopSeeds, prev.length));
      const fixed = prev.slice(0, keep);
      const pool = prev.slice(keep);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return [...fixed, ...pool];
    });
    clearSeedPreview();
  }

  function seedByNumber() {
    setSeededTeams(prev => orderBySeed(prev));
    clearSeedPreview();
  }

  function onSeedDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSeededTeams(prev => {
        const oldIndex = prev.findIndex(t => t.id === active.id);
        const newIndex = prev.findIndex(t => t.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      clearSeedPreview();
    }
  }

  /** Playoff-only: resolve a "Seed #N" placeholder to the seeded team's id. */
  function resolveSeedTeamId(label: string): string | null {
    const m = label.match(/^Seed #(\d+)$/);
    if (!m) return null;
    return seededTeams[Number(m[1]) - 1]?.id ?? null;
  }

  const availableDates = useMemo(() => {
    if (!tournament?.startDate || !tournament?.endDate) return [];
    const start = new Date(tournament.startDate + 'T12:00:00');
    const end = new Date(tournament.endDate + 'T12:00:00');
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [tournament?.startDate, tournament?.endDate]);

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
  const manualTravelBuffers = useMemo(() => resolveManualTravelBuffers({}, tournament), [tournament]);
  const roundRobinTiming = useMemo(() => resolveGameTiming(division, tournament), [division, tournament]);
  const roundRobinCompletion = useMemo(
    () => getRoundRobinCompletion(existingGames, roundRobinTiming.durationMinutes),
    [existingGames, roundRobinTiming.durationMinutes],
  );
  const earliestPlayoffStartLabel = useMemo(
    () => roundRobinCompletion
      ? roundRobinCompletion.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null,
    [roundRobinCompletion],
  );
  const currentPlayoffGames = useMemo(
    () => existingGames.filter(game => game.isPlayoff),
    [existingGames],
  );
  const replaceablePlayoffGames = useMemo(
    () => currentPlayoffGames.filter(game => game.status === 'scheduled' && !game.generatorLocked),
    [currentPlayoffGames],
  );
  const protectedPlayoffGames = useMemo(
    () => currentPlayoffGames.filter(game => game.status !== 'scheduled' || game.generatorLocked),
    [currentPlayoffGames],
  );
  const lockedPlayoffGameCount = useMemo(
    () => currentPlayoffGames.filter(game => game.status === 'scheduled' && game.generatorLocked).length,
    [currentPlayoffGames],
  );
  const canBuildFromCurrent = currentPlayoffGames.length > 0;
  const protectedFixedAssignments = protectedPlayoffGames
    .filter(game => game.date && game.time)
    .map(gameToFixedAssignment);
  const activeGenerationScope: GenerationScope = canBuildFromCurrent ? generationScope : 'replace';

  // Bracket-aware health (NOT round-robin per-team rest). A bracket's seeds flow
  // through the tree, so rest is a property of advancement edges, not of the
  // "Winner X"/"Loser X" placeholders. buildBracketScheduleMetrics measures the
  // edges (tightest turnaround, feasibility, worst-case games/day, longest run)
  // and scopes codes by pool so split-pool brackets don't cross-resolve.
  const bracketMetrics = useMemo(() => {
    if (preview.length === 0) return null;
    return buildBracketScheduleMetrics(
      preview.map((p: PlayoffPreviewRow) => ({
        code: p.code,
        home: p.home,
        away: p.away,
        date: p.date || null,
        time: p.time || null,
        pool: p.pool ?? null,
      })),
      { gameDurationMinutes: gameLength, minRestMinutes: priorities.minRestMinutes },
    );
  }, [preview, gameLength, priorities.minRestMinutes]);

  // The wizard preview is now READ-ONLY — in-modal bracket editing moved to the
  // inline BracketEditor on the main Schedule screen. Mirror the generated
  // template rows straight into the `preview` state that executeCreate + bracket
  // health read, filling a default date the same way the old editable canvas did,
  // so the Generate/save path stays byte-for-byte unchanged.
  useEffect(() => {
    const fallbackDate = tournament?.endDate || new Date().toISOString().split('T')[0];
    setPreview((templatePreview ?? []).map(p => ({
      round: p.round,
      home: p.home,
      away: p.away,
      code: p.code,
      date: p.date || fallbackDate || '',
      time: p.time || '',
      venueId: p.venueId || '',
      venueFacilityId: p.venueFacilityId || undefined,
      scheduleFacilityLaneId: p.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: p.scheduleFacilityLaneLabel ?? null,
      location: p.location ?? '',
      pool: p.pool,
      sourceGameId: p.sourceGameId,
    })));
  }, [templatePreview, tournament?.endDate]);

  // ── Read-only preview rendering (reuses the main screen's BracketColumns) ─────
  function previewFormatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Resolve a friendly field/venue label for a preview row (read-only display). */
  function resolvePreviewLocation(row: PlayoffPreviewRow): string {
    if (row.location) return row.location;
    if (row.scheduleFacilityLaneLabel) return row.scheduleFacilityLaneLabel;
    if (row.venueFacilityId) {
      for (const v of venues) {
        const f = v.facilities?.find(fac => fac.id === row.venueFacilityId);
        if (f) return `${v.name} · ${f.name}`;
      }
    }
    if (row.venueId) return venues.find(v => v.id === row.venueId)?.name ?? '';
    return '';
  }

  /** Map a preview row to the game-ish shape BracketColumns/buildBracketColumns expect. */
  function previewRowToGame(row: PlayoffPreviewRow, i: number) {
    return {
      id: row.sourceGameId || `${row.pool ?? ''}:${row.code}:${i}`,
      bracketCode: row.code,
      homePlaceholder: seedLabelFor ? seedLabelFor(row.home) : row.home,
      awayPlaceholder: seedLabelFor ? seedLabelFor(row.away) : row.away,
      date: row.date,
      time: row.time,
      location: resolvePreviewLocation(row),
    };
  }

  function savedPlayoffKey(item: Pick<PlayoffPreviewRow, 'code' | 'home' | 'away'>) {
    return `${item.code}:${item.home}:${item.away}`;
  }

  function gameToPreviewRow(game: Game): PlayoffPreviewRow {
    return {
      round: roundLabel(game.bracketCode || ''),
      home: game.homePlaceholder || teamLabel(game.homeTeamId) || 'Home',
      away: game.awayPlaceholder || teamLabel(game.awayTeamId) || 'Away',
      code: game.bracketCode || game.id,
      date: game.date || '',
      time: game.time || '',
      venueId: game.venueId || '',
      venueFacilityId: game.venueFacilityId || undefined,
      scheduleFacilityLaneId: game.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: game.scheduleFacilityLaneLabel ?? null,
      location: game.location || '',
      sourceGameId: game.id,
    };
  }

  function gameToFixedAssignment(game: Game): ScheduleDraftAssignment<unknown> {
    const home = game.homePlaceholder || teamLabel(game.homeTeamId) || 'Home';
    const away = game.awayPlaceholder || teamLabel(game.awayTeamId) || 'Away';
    return {
      matchupId: playoffMatchupKey({ code: game.bracketCode || game.id }),
      homeParticipantId: participantKey(home),
      awayParticipantId: participantKey(away),
      homeLabel: home,
      awayLabel: away,
      homeMetric: game.homeTeamId ? { teamId: game.homeTeamId } : { placeholder: home },
      awayMetric: game.awayTeamId ? { teamId: game.awayTeamId } : { placeholder: away },
      payload: {},
      date: game.date,
      time: game.time,
      venueId: game.venueId ?? null,
      venueName: game.location || 'TBD',
      venueFacilityId: game.venueFacilityId ?? null,
      scheduleFacilityLaneId: game.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: game.scheduleFacilityLaneLabel ?? null,
      slotIndex: -1,
    };
  }

  function teamLabel(teamId?: string | null) {
    if (!teamId) return null;
    return teams.find(team => team.id === teamId)?.name ?? null;
  }

  function roundLabel(code: string) {
    const upper = code.toUpperCase();
    if (upper.startsWith('QF')) return 'Quarterfinal';
    if (upper.startsWith('SF')) return 'Semifinal';
    if (upper === 'FIN') return 'Championship';
    if (upper === '3RD') return '3rd Place';
    return 'Playoff';
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

  function buildTimeSlots(resourceList: ScheduleResource[]): ScheduleDraftSlot[] {
    const totalSlots: ScheduleDraftSlot[] = [];
    const sortedDates = [...dateSlots].sort((a, b) => a.date.localeCompare(b.date));
    const roundTo5 = (d: Date) => { const ms = 1000 * 60 * 5; return new Date(Math.ceil(d.getTime() / ms) * ms); };
    const temporaryFacilities = Array.from(
      { length: Math.max(1, Math.min(16, Math.round(temporaryFacilityCount) || 1)) },
      (_, idx) => ({
        id: `draft-playoff-facility-${idx + 1}`,
        label: `Playoff Facility ${idx + 1}`,
      }),
    );

    sortedDates.forEach(slot => {
      if (!slot.date || !slot.startTime || !slot.endTime) return;
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

    return filterStartsAfterRoundRobinCompletion(totalSlots, roundRobinCompletion);
  }

  function playoffMatchupKey(item: Pick<PlayoffPreviewRow, 'code' | 'pool'>) {
    return `${item.pool ?? '__global__'}:${item.code}`;
  }

  function participantKey(label: string, pool?: string) {
    return `${pool ?? '__global__'}:${label}`;
  }

  function extractDependencyCodes(label: string): string[] {
    const match = label.match(/^(?:Winner|Loser)\s+([A-Za-z0-9_-]+)/);
    return match ? [match[1]] : [];
  }

  function autoSchedulePreviewRows(rows: PlayoffPreviewRow[]): { rows: PlayoffPreviewRow[]; summary: DraftOptimizationSummary } | null {
    const slots = buildTimeSlots(selectedResources);
    if (slots.length < rows.length) {
      setFeedback({
        isOpen: true,
        title: 'Not Enough Slots',
        message: `The playoff bracket needs ${rows.length} game slot${rows.length === 1 ? '' : 's'}, but only ${slots.length} are available${earliestPlayoffStartLabel ? ` after round robin completes (${earliestPlayoffStartLabel})` : ''}. Add dates, extend the time window, or select more facilities.`,
        type: 'warning',
      });
      return null;
    }

    const rowByKey = new Map(rows.map(row => [playoffMatchupKey(row), row]));
    const participantLabels = new Map<string, string>();
    const matchups: ScheduleDraftMatchup<PlayoffPreviewRow>[] = rows.map(row => {
      const homeParticipantId = participantKey(row.home, row.pool);
      const awayParticipantId = participantKey(row.away, row.pool);
      participantLabels.set(homeParticipantId, row.home);
      participantLabels.set(awayParticipantId, row.away);
      const dependsOnMatchupIds = [...extractDependencyCodes(row.home), ...extractDependencyCodes(row.away)]
        .map(code => playoffMatchupKey({ code, pool: row.pool }))
        .filter(key => rowByKey.has(key));

      return {
        matchupId: playoffMatchupKey(row),
        homeParticipantId,
        awayParticipantId,
        homeLabel: row.home,
        awayLabel: row.away,
        homeMetric: { placeholder: row.home },
        awayMetric: { placeholder: row.away },
        poolId: row.pool ?? null,
        dependsOnMatchupIds,
        dependencyMinRestMinutes: priorities.minRestMinutes,
        payload: row,
      };
    });

    const participants: ScheduleDraftParticipant[] = Array.from(participantLabels.entries()).map(([id, label]) => ({
      id,
      label,
      divisionId: division.id,
      status: 'accepted',
    }));

    const draft = generateScoredSchedule({
      tournamentId,
      divisionId: division.id,
      matchups,
      slots,
      participants,
      gameDurationMinutes: gameLength,
      bufferMinutes: breakLength,
      manualTravelBuffers,
      priorities,
      fixedAssignments: activeGenerationScope === 'build' ? protectedFixedAssignments : undefined,
    });

    if (!draft) {
      setFeedback({
        isOpen: true,
        title: 'No Playoff Draft Found',
        message: 'The selected windows could not satisfy bracket order and rest requirements. Try adding time, selecting more facilities, or lowering minimum rest.',
        type: 'warning',
      });
      return null;
    }

    const scheduledRows = draft.assignments.map(assignment => ({
      ...assignment.payload,
      date: assignment.date,
      time: assignment.time,
      venueId: assignment.venueId || '',
      venueFacilityId: assignment.venueFacilityId || undefined,
      scheduleFacilityLaneId: assignment.scheduleFacilityLaneId ?? null,
      scheduleFacilityLaneLabel: assignment.scheduleFacilityLaneLabel ?? null,
      location: assignment.venueName,
    }));

    return {
      rows: scheduledRows,
      summary: {
        score: draft.score,
        healthScore: draft.metrics.healthScore,
        candidateCount: draft.candidateCount,
      },
    };
  }

  async function materializeTemporaryFacilityLanes(rows: PlayoffPreviewRow[]): Promise<PlayoffPreviewRow[]> {
    const labels = Array.from(new Set(
      rows
        .filter(row => row.scheduleFacilityLaneId?.startsWith('draft-playoff-facility-'))
        .map(row => row.scheduleFacilityLaneLabel || row.location)
        .filter(Boolean) as string[],
    ));
    if (labels.length === 0) return rows;

    const res = await fetch(`/api/admin/schedule-facility-lanes${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ensure',
        tournamentId,
        divisionId: division.id,
        labels,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to prepare temporary playoff facilities');

    const laneByLabel = new Map((data.lanes as FacilityLaneEnsureRow[]).map(lane => [lane.label, lane.id]));
    return rows.map(row => {
      if (!row.scheduleFacilityLaneId?.startsWith('draft-playoff-facility-')) return row;
      const label = row.scheduleFacilityLaneLabel || row.location || 'Playoff Facility';
      return {
        ...row,
        venueId: '',
        venueFacilityId: undefined,
        scheduleFacilityLaneId: laneByLabel.get(label) ?? row.scheduleFacilityLaneId,
        scheduleFacilityLaneLabel: label,
        location: label,
      };
    });
  }

  function generatePreview() {
    const games: PlayoffTemplateGame[] = [];
    const { crossover, hasThirdPlace, teamsQualifying } = config;
    const pools = division.pools || [];

    if (crossover === 'tiers') {
      const v = validateTierRanges(config.tierConfigs, tierEligibleCount);
      if (!v.ok) {
        setFeedback({ isOpen: true, title: 'Check Tier Setup', message: v.error ?? 'Tier ranges are invalid.', type: 'warning' });
        return;
      }
    }

    // 1. No Crossover (Split Pool Championships) — each pool runs its OWN bracket
    //    through the same unified engine as single-bracket play, so every format
    //    (single / consolation / double / placement) is available per pool. The
    //    chosen `config.format` applies to all pools; qualifying count + (for the
    //    formats that have one) the 3rd-place game stay per-pool via splitConfigs.
    //    `Seed #k` references are remapped to this pool's ranked labels
    //    ("1st Pool A", "2nd Pool A", …); Winner/Loser references pass through.
    //    Each pool gets its own bracketId at save (see poolBracketIds below), and
    //    advancePlayoffs scopes Winner/Loser routing by bracketId so identical
    //    codes (e.g. WB1-1) never cross between pools.
    if (crossover === 'none' && pools.length >= 2) {
      pools.forEach(pool => {
        const poolConfig = config.splitConfigs?.[pool.id] || { teamsQualifying: config.teamsQualifying, hasThirdPlace: config.hasThirdPlace };
        const qTeams = poolConfig.teamsQualifying;
        const poolLabels = Array.from({ length: qTeams }, (_, i) => `${ordinal(i + 1)} Pool ${pool.name}`);
        const generated = generateBracket(qTeams, {
          format: config.format ?? 'single',
          thirdPlace: poolConfig.hasThirdPlace,
          grandFinalReset: config.grandFinalReset ?? true,
        });
        for (const m of generated) {
          games.push({
            round: m.round,
            code: m.code,
            pool: pool.name,
            home: remapSeedRef(m.home, poolLabels),
            away: remapSeedRef(m.away, poolLabels),
          });
        }
      });
    }
    // 1b. Tiered Brackets — split ONE division's OVERALL standings into N
    //     contiguous tiers, each an independent bracket. Each tier's bracket is
    //     generated locally (seeds 1..size) then its `Seed #k` refs are rewritten
    //     to GLOBAL `Seed #(fromSeed-1+k)` so advancePlayoffs resolves them from
    //     overall standings (round robin) or the seeded team list (playoff-only).
    //     `pool` carries the tier name (grouping + a distinct bracketId per tier
    //     at save), so identical Winner/Loser codes across tiers never collide.
    else if (crossover === 'tiers' && (config.tierConfigs?.length ?? 0) > 0) {
      for (const tier of config.tierConfigs!) {
        const size = tier.toSeed - tier.fromSeed + 1;
        if (size < 2) continue; // single-team tiers have no games
        const generated = generateBracket(size, {
          format: tier.format ?? config.format ?? 'single',
          thirdPlace: tier.hasThirdPlace ?? false,
          grandFinalReset: tier.grandFinalReset ?? config.grandFinalReset ?? true,
        });
        for (const m of generated) {
          games.push({
            round: m.round,
            code: m.code,
            pool: tier.name,
            home: remapTierSeed(m.home, tier.fromSeed),
            away: remapTierSeed(m.away, tier.fromSeed),
          });
        }
      }
    }
    // 2 & 3. Single-bracket seeding — standard crossover (interleaved pool
    // labels) or global reseed (Seed #1..N). Both feed the unified bracket
    // engine, which handles any team count (byes) and the single / consolation
    // (2-game guarantee) / double-elimination formats. `Seed #k` placeholders
    // are remapped to the seeding-mode labels.
    else {
      const labels = buildSeedLabels(config, pools);
      const generated = generateBracket(teamsQualifying, {
        format: config.format ?? 'single',
        thirdPlace: hasThirdPlace,
        grandFinalReset: config.grandFinalReset ?? true,
      });
      for (const m of generated) {
        games.push({
          round: m.round,
          code: m.code,
          home: remapSeedRef(m.home, labels),
          away: remapSeedRef(m.away, labels),
        });
      }
    }

    let nextPreview = games.map((g): PlayoffPreviewRow => {
      const existing = preview.find(p => p.code === g.code && p.pool === g.pool);
      // Prioritize tournament end date, fallback to today ONLY if we have no tournament info at all
      const tournamentEnd = tournament?.endDate;
      const today = new Date().toISOString().split('T')[0];
      const defaultDate = autoSchedule ? (tournamentEnd || today) : '';

      return { 
        ...g, 
        // If we have an existing date that isn't just a "today" fallback, keep it. 
        // Otherwise, use the tournament end date if available.
        date: (existing?.date && existing.date !== today) ? existing.date : defaultDate, 
        time: existing?.time || '', 
        venueId: existing?.venueId || '',
        venueFacilityId: existing?.venueFacilityId || undefined,
        scheduleFacilityLaneId: existing?.scheduleFacilityLaneId ?? null,
        scheduleFacilityLaneLabel: existing?.scheduleFacilityLaneLabel ?? null,
        location: existing?.location || '',
      };
    });

    const protectedRows = activeGenerationScope === 'build'
      ? protectedPlayoffGames.map(gameToPreviewRow)
      : [];
    const protectedCounts = protectedRows.reduce((map, row) => {
      const key = savedPlayoffKey(row);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>());
    const rowsToGenerate = nextPreview.filter(row => {
      const key = savedPlayoffKey(row);
      const remaining = protectedCounts.get(key) ?? 0;
      if (remaining <= 0) return true;
      if (remaining === 1) protectedCounts.delete(key);
      else protectedCounts.set(key, remaining - 1);
      return false;
    });

    setDraftSummary(null);
    if (autoSchedule) {
      if (dateSlots.some(s => !s.date)) {
        setFeedback({
          isOpen: true,
          title: 'Choose Playoff Dates',
          message: 'Select a date for every playoff scheduling window before auto-assigning game slots.',
          type: 'warning',
        });
        return;
      }
      if (rowsToGenerate.length > 0) {
        const scheduled = autoSchedulePreviewRows(rowsToGenerate);
        if (!scheduled) return;
        nextPreview = [...protectedRows, ...scheduled.rows];
        setDraftSummary(scheduled.summary);
      } else {
        nextPreview = protectedRows;
      }
    } else {
      nextPreview = [...protectedRows, ...rowsToGenerate];
    }

    setTemplatePreview(nextPreview);
  }

  // generatePreview is triggered explicitly from the preview action.

  async function handleCreate() {
    if (currentPlayoffGames.length > 0) {
      setShowWarning(true);
    } else {
      proceedAfterWarning();
    }
  }

  const baseOptions = React.useMemo(() => {
    if (config.crossover === 'none' && division.pools && division.pools.length > 0) {
      const options: string[] = [];
      const suffix = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
      division.pools.forEach(pool => {
        const pConfig = config.splitConfigs?.[pool.id] || { teamsQualifying: config.teamsQualifying, hasThirdPlace: config.hasThirdPlace };
        const perPool = pConfig.teamsQualifying;
        for (let i = 1; i <= perPool; i++) {
          options.push(`${i}${suffix[i-1] || 'th'} Pool ${pool.name}`);
        }
      });
      return options;
    }
    if (config.crossover === 'standard' && division.pools && division.pools.length > 0) {
      const options: string[] = [];
      const numPools = division.pools.length;
      const perPool = Math.ceil(config.teamsQualifying / numPools);
      const suffix = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'];
      division.pools.forEach(pool => {
        for (let i = 1; i <= perPool; i++) {
          options.push(`${i}${suffix[i-1] || 'th'} Pool ${pool.name}`);
        }
      });
      return options;
    }
    // Tiered: global seeds 1..(highest tier seed) — exactly the seeds used across
    // all tiers, so the missing-seed validation in proceedAfterWarning is exact.
    if (config.crossover === 'tiers' && (config.tierConfigs?.length ?? 0) > 0) {
      const maxSeed = Math.max(...config.tierConfigs!.map(t => t.toSeed));
      return Array.from({ length: Math.max(0, maxSeed) }, (_, i) => `Seed #${i + 1}`);
    }
    const numSeeds = config.teamsQualifying || division.capacity || teams.length || 16;
    return Array.from({length: numSeeds}, (_, i) => `Seed #${i + 1}`);
  }, [config.crossover, config.teamsQualifying, config.hasThirdPlace, config.splitConfigs, config.tierConfigs, division.pools, division.capacity, teams.length]);

  function validatePlayoffStartsAfterRoundRobin(rows: PlayoffPreviewRow[]) {
    const earlyRows = rows.filter(row => startsBeforeRoundRobinCompletion(row, roundRobinCompletion));
    if (earlyRows.length === 0) return true;

    setFeedback({
      isOpen: true,
      title: 'Playoffs Start Too Early',
      message: `Playoff games cannot start before round robin is complete. The earliest valid playoff start is ${earliestPlayoffStartLabel ?? 'after the last round-robin game'}. Update the playoff date/time windows and try again.`,
      type: 'warning',
    });
    return false;
  }

  function proceedAfterWarning() {
    setShowWarning(false);

    if (config.crossover === 'tiers') {
      const v = validateTierRanges(config.tierConfigs, tierEligibleCount);
      if (!v.ok) {
        setFeedback({ isOpen: true, title: 'Check Tier Setup', message: v.error ?? 'Tier ranges are invalid.', type: 'warning' });
        return;
      }
    }

    // Check for missing seeds from baseOptions that aren't in any matchup
    const usedSeeds = new Set(preview.flatMap(p => [p.home, p.away]));
    const missingSeeds = baseOptions.filter(opt => !usedSeeds.has(opt));
    
    if (missingSeeds.length > 0) {
      setFeedback({ 
        isOpen: true, 
        title: 'Missing Teams', 
        message: `The following required teams are not scheduled in any matchup: ${missingSeeds.join(', ')}. Please add them to the bracket before generating.`, 
        type: 'warning' 
      });
      return;
    }

    if (!validatePlayoffStartsAfterRoundRobin(preview)) return;

    if (preview.some(p => !p.date || !p.time || (!p.venueId && !p.scheduleFacilityLaneId))) {
      setShowConfirm(true);
    } else {
      executeCreate();
    }
  }

  async function executeCreate() {
    if (!validatePlayoffStartsAfterRoundRobin(preview)) return;

    setLoading(true);
    setShowConfirm(false);
    try {
      // In No Crossover and Tiered modes each pool/tier gets its own bracketId so
      // transitive inference (FIN → Winner SF1 → SF1) matches by bracketId and
      // identical codes never collide between pools/tiers that share them.
      const usesPerGroupBrackets = config.crossover === 'none' || config.crossover === 'tiers';
      const poolBracketIds: Record<string, string> = {};
      const defaultBracketId = crypto.randomUUID();
      if (usesPerGroupBrackets) {
        for (const p of preview) {
          if (p.pool && !poolBracketIds[p.pool]) {
            poolBracketIds[p.pool] = crypto.randomUUID();
          }
        }
      }

      const previewToCreate = activeGenerationScope === 'build'
        ? preview.filter(row => !row.sourceGameId)
        : preview;
      const previewToSave = await materializeTemporaryFacilityLanes(previewToCreate);
      const gameRows = previewToSave.map(p => {
        const bracketId = (usesPerGroupBrackets && p.pool && poolBracketIds[p.pool])
          ? poolBracketIds[p.pool]
          : defaultBracketId;
        return {
          tournamentId,
          divisionId: division.id,
          // Playoff-only: seeds are known up front, so resolve them to real teams
          // at creation (round-robin tournaments leave these null until standings
          // resolve them via advancePlayoffs).
          homeTeamId: isPlayoffOnly ? resolveSeedTeamId(p.home) : null,
          awayTeamId: isPlayoffOnly ? resolveSeedTeamId(p.away) : null,
          date: p.date || null,
          time: p.time || null,
          durationMinutes: gameLength,
          location: (() => {
            if (p.scheduleFacilityLaneId) return p.scheduleFacilityLaneLabel || p.location || 'TBD';
            const v = venues.find(d => d.id === p.venueId);
            if (!v) return 'TBD';
            const f = p.venueFacilityId ? v.facilities?.find(f => f.id === p.venueFacilityId) : null;
            return f ? `${v.name} — ${f.name}` : v.name;
          })(),
          venueId:         p.venueId         || undefined,
          venueFacilityId: p.venueFacilityId || undefined,
          scheduleFacilityLaneId: p.scheduleFacilityLaneId || undefined,
          scheduleFacilityLaneLabel: p.scheduleFacilityLaneLabel || undefined,
          status: 'scheduled',
          isPlayoff: true,
          bracketId,
          bracketCode: p.code,
          homePlaceholder: p.home,
          awayPlaceholder: p.away,
          notes: undefined
        };
      });

      if (replaceablePlayoffGames.length > 0 ||
          (activeGenerationScope === 'replace' && currentPlayoffGames.length > 0)) {
        const deleteBody = activeGenerationScope === 'build'
          ? {
              action: 'delete-playoff-games',
              tournamentId,
              gameIds: replaceablePlayoffGames.map(game => game.id),
            }
          : {
              action: 'delete-division-playoff-games',
              divisionId: division.id,
            };
        const deleteRes = await fetch(`/api/admin/games${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteBody),
        });
        const deleteData = await deleteRes.json();
        if (!deleteRes.ok) throw new Error(deleteData.error || 'Failed to clear existing playoff games');
      }

      if (gameRows.length > 0) {
        const saveRes = await fetch(`/api/admin/games${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // `autoScheduled` tells the server whether the optimizer produced these
          // rows (Plus) vs a manually-built bracket (free). See games route gate.
          body: JSON.stringify({ action: 'bulk-save', games: gameRows, tournamentId, divisionId: division.id, autoScheduled: autoSchedule && canAutoSchedule }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save playoff bracket');
      }
      // Each playoff game now carries its own `durationMinutes` (set above), so
      // conflict checks and Schedule Health validate it against its own length —
      // no tournament-level playoff override needed.
      onComplete();
    } catch (err) {
      console.error(err);
      setFeedback({ isOpen: true, title: 'Error', message: err instanceof Error ? err.message : 'Failed to generate bracket. Please try again.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { overlayMouseDownRef.current = e.target === e.currentTarget; }}
      onClick={e => {
        if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose();
        overlayMouseDownRef.current = false;
      }}
    >
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '95vh', width: '100%', maxWidth: templatePreview.length > 0 ? 'min(95vw, 1360px)' : '700px' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="flex-between">
            <div className="flex gap-3">
              <div className="flex-center" style={{ width: '40px', height: '40px', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', borderRadius: '2px', color: 'var(--logic-lime)', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.3)' }}>
                <Trophy size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Playoff Bracket Builder</h3>
                <p className="text-label" style={{ color: 'var(--logic-lime)', marginTop: '0.25rem' }}>{division.name} Division</p>
              </div>
            </div>
            <button className="btn btn-ghost btn-data" onClick={onClose} style={{ padding: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Step 1: Configuration */}
            <section>
              <h4 className="text-label" style={{ marginBottom: '1rem', color: 'rgba(var(--logic-lime-rgb), 0.65)' }}>1. Bracket Configuration</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {divisions.length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Division</label>
                    <select className="form-select" value={selectedDivisionId} onChange={e => setSelectedDivisionId(e.target.value)}>
                      {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {!isPlayoffOnly && (
                <div className="form-group">
                  <label className="form-label">Crossover Rules</label>
                  <select className="form-select" value={config.crossover} onChange={e => setConfig({...config, crossover: e.target.value as PlayoffConfig['crossover']})}>
                    {(division.pools?.length || 0) === 2 && <option value="standard">Standard (Pool A vs. Pool B Crossover)</option>}
                    <option value="reseed">Global Reseed (Top vs. Bottom Seeding)</option>
                    <option value="none">No Crossover (Each Pool Plays Own Finals)</option>
                    <option value="tiers">Tiered Brackets (split standings into tiers)</option>
                  </select>
                  <small className={styles.crossoverHint}>
                    {config.crossover === 'standard' && '1st in Pool A plays 2nd in Pool B, and vice versa. Requires exactly 2 pools.'}
                    {config.crossover === 'reseed' && 'All qualifying teams are globally ranked. Seed #1 plays the lowest seed, #2 plays the second-lowest, etc.'}
                    {config.crossover === 'none' && 'Each pool runs its own independent championship bracket with no cross-pool matchups.'}
                    {config.crossover === 'tiers' && 'Splits the division’s overall standings into separate tiers (e.g. seeds 1–5 and 6–9), each its own bracket. Lower seeds still get a championship.'}
                  </small>
                </div>
                )}

                {/* Bracket Format — applies to all pools when each pool runs its own bracket. */}
                <div className="form-group">
                  <label className="form-label">Bracket Format</label>
                  <select className="form-select" value={config.format ?? 'single'} onChange={e => setConfig({...config, format: e.target.value as PlayoffConfig['format']})}>
                    <option value="single">Single Elimination (1-game guarantee)</option>
                    <option value="consolation">Consolation (2-game guarantee)</option>
                    <option value="double">Double Elimination</option>
                    <option value="placement">Full Placement (every team ranked)</option>
                  </select>
                  <small className={styles.crossoverHint}>
                    {(config.format ?? 'single') === 'single' && 'Lose once and you are out. Top seeds receive a bye when the team count is uneven.'}
                    {config.format === 'consolation' && 'First-round losers drop into a consolation bracket, so no team is eliminated after a single game.'}
                    {config.format === 'double' && 'A losers bracket gives every team a second life — a team must lose twice to be eliminated.'}
                    {config.format === 'placement' && 'Every team keeps playing to a final position (5th, 7th, …) — no one is eliminated, everyone finishes ranked.'}
                    {config.crossover === 'none' && ' Applied to every pool’s bracket.'}
                  </small>
                </div>
                {/* Qualified Teams — single-bracket only (split-pool sets it per pool below). */}
                {config.crossover !== 'none' && !isPlayoffOnly && (
                  <div className="form-group">
                    <label className="form-label">Teams advancing</label>
                    <NumberStepper
                      value={Math.min(config.teamsQualifying, Math.max(2, teams.length))}
                      min={2}
                      max={Math.max(2, teams.length)}
                      step={config.crossover === 'standard' ? 2 : 1}
                      onChange={v => setConfig({ ...config, teamsQualifying: v })}
                      ariaLabel="Number of teams advancing to the bracket"
                    />
                    <small className={styles.crossoverHint}>
                      Top {config.teamsQualifying} of {teams.length} advance{config.crossover === 'standard' ? ', split across the two pools' : ''}.
                      {(() => { const b = nextPow2(config.teamsQualifying) - config.teamsQualifying; return b > 0 ? ` ${b} bye${b === 1 ? '' : 's'} to the top seed${b === 1 ? '' : 's'}.` : ''; })()}
                    </small>
                  </div>
                )}
                {/* If-necessary grand final — double elimination, applies to all pools. */}
                {config.format === 'double' && (
                  <div className="form-group" style={{ justifyContent: 'center' }}>
                     <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={config.grandFinalReset ?? true} onChange={e => setConfig({...config, grandFinalReset: e.target.checked})} />
                      <span className="text-sm font-bold">Play if-necessary grand final (reset)</span>
                    </label>
                  </div>
                )}
                {/* 3rd-place game — single-bracket single/consolation only (split-pool sets it per pool). */}
                {config.crossover !== 'none' && config.format !== 'double' && config.format !== 'placement' && (
                  <div className="form-group" style={{ justifyContent: 'center' }}>
                     <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={config.hasThirdPlace} onChange={e => setConfig({...config, hasThirdPlace: e.target.checked})} />
                      <span className="text-sm font-bold">Include 3rd Place / Consolidation Game</span>
                    </label>
                  </div>
                )}
              </div>

              {config.crossover === 'none' && division.pools && (
                <div style={{ marginTop: '1.5rem', background: 'var(--bg-2)', padding: '1.5rem', borderRadius: '2px', border: '1px solid var(--border)' }}>
                  <h5 className="font-bold text-sm mb-4" style={{ color: 'var(--logic-lime)' }}>Per-Pool Independent Brackets</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {division.pools.map(pool => {
                      const pConfig = config.splitConfigs?.[pool.id] || { teamsQualifying: 4, hasThirdPlace: false };
                      const poolTeamCount = teams.filter(t => t.poolId === pool.id).length;
                      return (
                        <div key={pool.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '2rem', alignItems: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: '2px', border: '1px solid var(--border)' }}>
                          <span className="font-bold">{formatPoolName(pool.name)}</span>
                          <div className="flex gap-3 items-center">
                            <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Advancing:</span>
                            <NumberStepper
                              value={Math.min(pConfig.teamsQualifying, Math.max(2, poolTeamCount))}
                              min={2}
                              max={Math.max(2, poolTeamCount)}
                              step={1}
                              onChange={v => setConfig({
                                ...config,
                                splitConfigs: {
                                  ...(config.splitConfigs || {}),
                                  [pool.id]: { ...pConfig, teamsQualifying: v }
                                }
                              })}
                              ariaLabel={`Teams advancing in ${formatPoolName(pool.name)}`}
                            />
                          </div>
                          {config.format !== 'double' && config.format !== 'placement' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pConfig.hasThirdPlace}
                              onChange={e => setConfig({
                                ...config,
                                splitConfigs: {
                                  ...(config.splitConfigs || {}),
                                  [pool.id]: { ...pConfig, hasThirdPlace: e.target.checked }
                                }
                              })}
                            />
                            <span className="text-xs font-bold">3rd Place</span>
                          </label>
                          ) : <span />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {config.crossover === 'tiers' && (
                <div style={{ marginTop: '1.5rem', background: 'var(--bg-2)', padding: '1.5rem', borderRadius: '2px', border: '1px solid var(--border)' }}>
                  <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                    <h5 className="font-bold text-sm" style={{ color: 'var(--logic-lime)', margin: 0 }}>
                      <Layers size={14} style={{ marginRight: '0.4rem', verticalAlign: '-2px' }} />
                      Tiered Brackets
                    </h5>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addTier} style={{ color: 'var(--logic-lime)' }}>
                      <Plus size={13} /> Add Tier
                    </button>
                  </div>
                  <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>
                    Each tier is an independent bracket seeded from the division’s overall standings.
                    {tierEligibleCount > 0 ? ` ${tierEligibleCount} team${tierEligibleCount === 1 ? '' : 's'} eligible.` : ''}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {tierConfigs.map((tier, idx) => {
                      const size = tier.toSeed - tier.fromSeed + 1;
                      const byes = nextPow2(size) - size;
                      const effFormat = tier.format ?? config.format ?? 'single';
                      const showThird = effFormat !== 'double' && effFormat !== 'placement';
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) auto minmax(120px, 1.2fr) auto auto', gap: '0.625rem', alignItems: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: '2px', border: '1px solid var(--border)', minWidth: 0 }}>
                          <input
                            className="form-input"
                            value={tier.name}
                            onChange={e => updateTier(idx, { name: e.target.value })}
                            placeholder={`Tier ${idx + 1}`}
                            aria-label={`Tier ${idx + 1} name`}
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>Seeds {tier.fromSeed}–</span>
                            <NumberStepper
                              value={tier.toSeed}
                              min={tier.fromSeed + 1}
                              max={Math.max(tier.fromSeed + 1, tierEligibleCount || tier.toSeed)}
                              onChange={v => updateTier(idx, { toSeed: v })}
                              ariaLabel={`Last seed in ${tier.name}`}
                            />
                            <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                              ({size} team{size === 1 ? '' : 's'}{byes > 0 ? `, ${byes} bye${byes === 1 ? '' : 's'}` : ''})
                            </span>
                          </div>
                          <select className="form-select" value={effFormat} onChange={e => updateTier(idx, { format: e.target.value as PlayoffTierConfig['format'] })} aria-label={`${tier.name} format`}>
                            <option value="single">Single Elim</option>
                            <option value="consolation">Consolation</option>
                            <option value="double">Double Elim</option>
                            <option value="placement">Full Placement</option>
                          </select>
                          {showThird ? (
                            <label className="flex items-center gap-2 cursor-pointer" title="Include a 3rd-place game in this tier">
                              <input type="checkbox" checked={tier.hasThirdPlace ?? false} onChange={e => updateTier(idx, { hasThirdPlace: e.target.checked })} />
                              <span className="text-xs font-bold">3rd</span>
                            </label>
                          ) : <span />}
                          <button type="button" className="btn btn-ghost btn-data" onClick={() => removeTier(idx)} disabled={tierConfigs.length <= 1} title="Remove tier" style={{ padding: '0.4rem' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {!tierValidation.ok ? (
                    <p className="text-xs" style={{ color: 'var(--danger)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertCircle size={13} /> {tierValidation.error}
                    </p>
                  ) : (
                    <p className="text-muted text-xs" style={{ marginTop: '0.75rem' }}>
                      Tiers cover seeds 1–{Math.max(...tierConfigs.map(t => t.toSeed))}{tierEligibleCount > 0 ? ` of ${tierEligibleCount}` : ''}. Lower-ranked teams outside the tiers don’t play in the bracket.
                    </p>
                  )}
                </div>
              )}
            </section>

            {isPlayoffOnly && (
              <section>
                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                  <h4 className="text-label" style={{ margin: 0, color: 'rgba(var(--logic-lime-rgb), 0.65)' }}>Seed Teams</h4>
                  <div className="flex items-center gap-3">
                    {seededTeams.length >= 3 && (
                      <label className="flex items-center gap-2" title="Keep the top N seeds fixed when randomizing the rest.">
                        <span className="text-muted text-xs" style={{ whiteSpace: 'nowrap' }}>Protect top</span>
                        <NumberStepper value={protectTopSeeds} min={0} max={seededTeams.length} onChange={setProtectTopSeeds} ariaLabel="Protect top seeds when randomizing" />
                      </label>
                    )}
                    {seededTeams.some(t => typeof t.seed === 'number') && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={seedByNumber} disabled={seededTeams.length < 2} style={{ color: 'var(--logic-lime)' }} title="Order by the seed numbers set in the Teams admin (1 = top seed).">
                        <ListOrdered size={13} /> By Seed #
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={randomizeSeeds} disabled={seededTeams.length < 2} style={{ color: 'var(--logic-lime)' }}>
                      <Shuffle size={13} /> Randomize
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setConfig(c => ({ ...c, crossover: c.crossover === 'tiers' ? 'reseed' : 'tiers' }))}
                      disabled={seededTeams.length < 4}
                      style={{ color: config.crossover === 'tiers' ? 'var(--logic-lime)' : undefined }}
                      title="Split the seeded teams into separate tiered brackets"
                    >
                      <Layers size={13} /> {config.crossover === 'tiers' ? 'Single bracket' : 'Split into tiers'}
                    </button>
                  </div>
                </div>
                {seededTeams.length < 2 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                      Add at least two accepted teams to <strong>{division.name}</strong> to build a bracket. Teams appear here once they are registered and accepted.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-muted text-xs" style={{ marginBottom: '0.75rem' }}>
                      Drag to set the seeding, use By Seed # (from the Teams admin), or hit Randomize. {seedByeCount > 0
                        ? `Top ${seedByeCount} seed${seedByeCount === 1 ? '' : 's'} get a first-round bye (${seededTeams.length} teams).`
                        : `No byes — ${seededTeams.length} teams is a power of two.`}
                    </p>
                    <DndContext sensors={seedSensors} collisionDetection={closestCenter} onDragEnd={onSeedDragEnd}>
                      <SortableContext items={seededTeams.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {seededTeams.map((t, i) => (
                            <SortableSeed key={t.id} id={t.id} seed={i + 1} teamName={t.name} isBye={i < seedByeCount} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </>
                )}
              </section>
            )}

            <section>
              <h4 className="text-label" style={{ marginBottom: '1rem', color: 'rgba(var(--logic-lime-rgb), 0.65)' }}>2. Scheduling Options</h4>
              {canBuildFromCurrent && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Regeneration Scope</label>
                <div className={styles.generatorSegmented}>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${generationScope === 'replace' ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => setGenerationScope('replace')}
                    title="Clears playoff games for this division before saving the bracket."
                  >
                    Replace bracket
                  </button>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${generationScope === 'build' ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => setGenerationScope('build')}
                    title="Keeps submitted, completed, cancelled, and manually kept playoff games while replacing unlocked scheduled playoff games."
                  >
                    Build from current
                  </button>
                </div>
                {currentPlayoffGames.length > 0 && (
                  <p className="text-muted text-xs" style={{ marginTop: '0.5rem' }}>
                    {protectedPlayoffGames.length} protected
                    {lockedPlayoffGameCount > 0 ? ` (${lockedPlayoffGameCount} manually kept)` : ''} · {replaceablePlayoffGames.length} scheduled replaceable
                  </p>
                )}
              </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Playoff Timing</label>
                <div className={styles.generatorSegmented}>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${autoSchedule ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => { if (canAutoSchedule) setAutoSchedule(true); }}
                    disabled={!canAutoSchedule}
                    title={canAutoSchedule ? undefined : 'Automated schedule generation is included with Tournament Plus, League Plus, and Club.'}
                    style={!canAutoSchedule ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
                  >
                    {!canAutoSchedule && <Lock size={11} style={{ marginRight: '0.35rem' }} />}
                    Auto-schedule dates & times
                  </button>
                  <button
                    type="button"
                    className={`${styles.generatorSegBtn} ${!autoSchedule ? styles.generatorSegBtnActive : ''}`}
                    onClick={() => setAutoSchedule(false)}
                  >
                    Bracket structure only
                  </button>
                </div>
                <p className="text-muted text-xs" style={{ marginTop: '0.5rem' }}>
                  {!canAutoSchedule
                    ? 'Creates the bracket matchup structure — you assign dates and fields manually in the game slots below. Auto-scheduling dates & times is included with Tournament Plus, League Plus, and Club.'
                    : autoSchedule
                    ? 'Games are assigned to the date windows you set below. Team names are placeholders until standings are final after round robin.'
                    : 'Creates the bracket matchup structure only — you assign dates and fields manually in the game slots below.'}
                </p>
              </div>

              {autoSchedule && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Playoff Dates
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addDateSlot} style={{ color: 'var(--logic-lime)' }}>
                        <Plus size={14} /> Add Date
                      </button>
                    </label>
                    {earliestPlayoffStartLabel && (
                      <p className="text-muted text-xs" style={{ marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                        Earliest playoff start: {earliestPlayoffStartLabel}, after the last round-robin game ends.
                      </p>
                    )}
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
                          <span className={styles.dateSlotSep}>-</span>
                          <input type="time" className={styles.dateSlotTime} value={slot.endTime} onChange={e => updateDateSlot(idx, { endTime: e.target.value })} />
                          <button type="button" className={`btn btn-ghost btn-data ${styles.dateSlotDel}`} onClick={() => removeDateSlot(idx)} disabled={dateSlots.length === 1}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Game Duration (min)</label>
                      <NumberStepper value={gameLength} min={1} max={480} step={5} onChange={setGameLength} ariaLabel="Game duration in minutes" />
                      <small className={styles.fieldHint}>Length for the games this builder creates (defaults to the event length). Each game is saved with this length; you can change an individual game afterward.</small>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Turnover Time (min)</label>
                      <NumberStepper value={breakLength} min={0} max={120} step={5} onChange={setBreakLength} ariaLabel="Turnover time in minutes" />
                      <small className={styles.fieldHint}>Gap between games at the same facility.</small>
                    </div>
                  </div>

                  <div className={styles.priorityPanel}>
                    <div className={styles.priorityHeader}>
                      <span><Sparkles size={14} /> Scheduling Priorities</span>
                      <small>Best of {priorities.candidateCount}</small>
                    </div>
                    <details className={styles.advancedDrawer}>
                      <summary className={styles.advancedSummary}>
                        <SlidersHorizontal size={11} /> Advanced Settings
                      </summary>
                      <div className={styles.advancedDrawerContent}>
                        <div className={styles.prioritySection}>
                          <div className={styles.prioritySectionHeader}>
                            <span>Limits</span>
                            <small>Used for playoff rest and daily load</small>
                          </div>
                          <div className={styles.limitsRow}>
                            <label className={styles.limitItem} title="Caps how many games one placeholder or resolved team can play in a day.">
                              <span className={styles.limitLabel}>Max / day</span>
                              <NumberStepper
                                value={priorities.maxGamesPerDay}
                                min={1}
                                max={6}
                                onChange={v => updatePriorities({ maxGamesPerDay: v })}
                                ariaLabel="Max games per day"
                              />
                              <small className={styles.limitUnit}>per team</small>
                            </label>
                            <label className={styles.limitItem} title="Minimum rest after a source game before a dependent playoff game can start.">
                              <span className={styles.limitLabel}>Min rest</span>
                              <NumberStepper
                                value={priorities.minRestMinutes}
                                min={0}
                                max={360}
                                step={15}
                                onChange={v => updatePriorities({ minRestMinutes: v })}
                                ariaLabel="Minimum rest minutes"
                              />
                              <small className={styles.limitUnit}>min between rounds</small>
                            </label>
                          </div>
                        </div>
                        <div className={styles.prioritySection}>
                          <div className={styles.prioritySectionHeader}>
                            <span>Preferences</span>
                            <small>Scoring tradeoffs for better brackets</small>
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

                  <div className="form-group">
                    <label className="form-label">Available Facilities</label>
                    <small className={styles.fieldHint} style={{ display: 'block', marginBottom: '0.45rem' }}>Select which fields or diamonds the generator can assign playoff games to.</small>
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
                          <span>Playoff games can be resolved to real venues later.</span>
                        </div>
                        <label>
                          <span>Facilities</span>
                          <NumberStepper
                            value={temporaryFacilityCount}
                            min={1}
                            max={16}
                            onChange={setTemporaryFacilityCount}
                            ariaLabel="Temporary facility count"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(var(--blueprint-blue-rgb), 0.08)', borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <h4 className="font-bold text-sm text-primary-light" style={{ marginBottom: '0.25rem' }}>Preview Bracket</h4>
                <p className="text-muted text-xs">Generates the bracket layout based on your configuration above. Resets the custom bracket canvas if you&apos;ve made manual edits.</p>
              </div>
              <button className="btn btn-lime btn-data" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={generatePreview}>
                <Sparkles size={13} /> Preview Bracket
              </button>
            </div>

            <div className="divider"></div>

            {/* Step 3: Game Slots */}
            <section>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h4 className="text-label" style={{ color: 'rgba(var(--logic-lime-rgb), 0.65)' }}>3. Game Slots & Scheduling</h4>
                <span className="badge badge-neutral">{preview.length} Games</span>
              </div>

              {templatePreview.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon"><Calendar size={32} /></div>
                  <h4 className="display-sm" style={{ marginBottom: '0.5rem' }}>No Matches Generated</h4>
                  <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Adjust your bracket configuration above, then create a bracket or schedule playoff windows.
                  </p>
                </div>
              ) : (
                <>
                  {activeGenerationScope === 'build' && protectedPlayoffGames.length > 0 && (
                    <div className={styles.partialPreviewSummary}>
                      <span>Build from current</span>
                      <strong>{protectedPlayoffGames.length}</strong>
                      <small>protected</small>
                      <strong>{lockedPlayoffGameCount}</strong>
                      <small>locked</small>
                      <strong>{replaceablePlayoffGames.length}</strong>
                      <small>replaceable</small>
                    </div>
                  )}

                  {draftSummary && (
                    <div className={styles.optimizationSummary}>
                      <span><Sparkles size={13} /> Best of {draftSummary.candidateCount} playoff drafts</span>
                      <strong>{draftSummary.score}</strong>
                      <small>Health {draftSummary.healthScore}/100</small>
                    </div>
                  )}

                  {bracketMetrics && (
                    <BracketHealthPanel
                      metrics={bracketMetrics}
                      title="Playoff Draft Health"
                      subtitle={`${division.name} · ${autoSchedule ? 'Scheduled playoff windows' : 'Bracket only'}`}
                    />
                  )}

                  {autoSchedule && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--white-5)', borderRadius: '2px', margin: '0.75rem 0', fontSize: '0.8rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
                      <Info size={14} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--blueprint-blue)' }} />
                      These windows use seed and winner placeholders until standings and bracket advancement resolve the actual teams.
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--white-5)', borderRadius: '2px', margin: '0.75rem 0', fontSize: '0.8rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
                    <Info size={14} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--blueprint-blue)' }} />
                    Preview only. Click <strong>Generate Playoff Bracket</strong> to save it, then fine-tune dates, fields and matchups on the schedule with <strong>Edit Bracket</strong>.
                  </div>

                  {(() => {
                    const poolNames = Array.from(
                      new Set(templatePreview.map(p => p.pool).filter((p): p is string => !!p)),
                    );
                    if (poolNames.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                          {poolNames.map(poolName => (
                            <div key={poolName}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Trophy size={16} style={{ color: 'var(--logic-lime)' }} />
                                <h4 className="text-label" style={{ margin: 0, color: 'var(--logic-lime)' }}>
                                  {config.crossover === 'tiers' ? poolName : `${formatPoolName(poolName)} Playoffs`}
                                </h4>
                              </div>
                              <BracketColumns
                                columns={buildBracketColumns(templatePreview.filter(p => p.pool === poolName).map(previewRowToGame))}
                                readOnly
                                formatDate={previewFormatDate}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <BracketColumns
                        columns={buildBracketColumns(templatePreview.map(previewRowToGame))}
                        readOnly
                        formatDate={previewFormatDate}
                      />
                    );
                  })()}
                </>
              )}
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '1.5rem 2rem', background: 'var(--surface-2)', margin: 0 }}>
          <button className="btn btn-ghost btn-data" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-lime btn-data" onClick={handleCreate} disabled={loading || preview.length === 0} style={{ padding: '0.75rem 2rem' }}>
            {loading ? <><RefreshCw className="spin" size={14} /> Creating...</> : <><Check size={14} /> Generate Playoff Bracket</>}
          </button>
        </div>

      </div>

      {/* Missing Info Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
          <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '2rem', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div className="flex-center mb-6" style={{ width: '60px', height: '60px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '100%', margin: '0 auto', color: '#fbbf24' }}>
              <AlertCircle size={32} />
            </div>
            <h3 className="display-sm mb-2" style={{ fontSize: '1.25rem' }}>Missing Information</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>Some games are missing a date or field assignment. Are you sure you want to generate the bracket now?</p>
            <div className="flex gap-3">
              <button className="btn btn-ghost flex-1" onClick={() => setShowConfirm(false)}>Go Back</button>
              <button className="btn btn-primary flex-1" onClick={executeCreate}>Continue Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Existing Warning Modal */}
      {showWarning && (
        <div className="modal-overlay" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.8)' }} onClick={e => e.stopPropagation()}>
          <div className="card" style={{ maxWidth: '440px', width: '90%', padding: '2.5rem', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', border: '1px solid var(--danger)' }}>
            <div className="flex-center mb-6" style={{ width: '70px', height: '70px', background: 'rgba(var(--danger-rgb),0.1)', borderRadius: '100%', margin: '0 auto', color: 'var(--danger)' }}>
              <AlertCircle size={36} />
            </div>
            <h3 className="display-sm mb-3" style={{ fontSize: '1.4rem', color: 'var(--white)' }}>
              {activeGenerationScope === 'build' ? 'Build From Current Bracket?' : 'Replace Existing Bracket?'}
            </h3>
            <p className="text-muted" style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              {activeGenerationScope === 'build' ? (
                <>
                  This will keep <strong>{protectedPlayoffGames.length}</strong> protected playoff games{lockedPlayoffGameCount > 0 ? <> (<strong>{lockedPlayoffGameCount}</strong> manually kept)</> : null}, replace <strong>{replaceablePlayoffGames.length}</strong> unlocked scheduled playoff games, and save the new bracket rows for the {division.name} division.
                </>
              ) : (
                <>
                  Generating a new playoff bracket will <strong style={{ color: 'var(--danger)' }}>delete all existing playoff games and scores</strong> for the {division.name} division. This action cannot be undone.
                </>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={proceedAfterWarning}>
                {activeGenerationScope === 'build' ? 'Build From Current' : 'Yes, Delete and Replace'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowWarning(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} />
    </div>
  );
}
