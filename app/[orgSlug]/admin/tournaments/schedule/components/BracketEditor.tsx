'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Check, RefreshCw, Sparkles, AlertTriangle, Layers, Plus, Trash2 } from 'lucide-react';
import { Division, Team, Venue, Tournament, Game, PlayoffTierConfig } from '@/lib/types';
import { nextPow2, seedOrder, findBracketSchedulingViolations, gamesToBracketPreview, computeBracketColumns, suggestDefaultTiers, validateTierRanges, remapTierSeed } from '@/lib/playoff-bracket';
import { isPlayoffOnly as resolveIsPlayoffOnly } from '@/lib/tournament-phase';
import { buildBracketScheduleMetrics } from '@/lib/bracket-schedule-metrics';
import NumberStepper from '@/components/admin/NumberStepper';
import FeedbackModal from '@/components/FeedbackModal';
import BracketBuilder from './BracketBuilder';
import BracketHealthPanel from './BracketHealthPanel';

interface Props {
  division: Division;
  tournamentId: string;
  tournament?: Tournament | null;
  orgSlug?: string;
  /** The division's existing playoff games (from the page). Empty → build mode. */
  existingGames: Game[];
  /** Whether the org can auto-generate (Plus) — shown as an upsell only. */
  canAutoGenerate?: boolean;
  onUseAutoGenerator?: () => void;
  /** Optional game id to open + scroll to on mount (entered from a List-view row). */
  focusGameId?: string;
  /** Min rest (minutes) for the live health read-out — the org's configured
   *  schedule-health rule, so it matches the saved-schedule panel. Falls back to 60. */
  minRestMinutes?: number;
  /** Exit edit mode. `saved` true → the page should refresh. */
  onDone: (saved: boolean) => void;
}

interface PreviewRow {
  round: string;
  code: string;
  home: string;
  away: string;
  date: string;
  time: string;
  venueId: string;
  venueFacilityId?: string;
  location?: string;
  sourceGameId?: string;
  /** Tier/group name when the division has multiple brackets (tiers). Drives the canvas split. */
  pool?: string;
}

/** Stable signature of the editable fields, for dirty-comparison (includes the round name + tier, now persisted). */
function serializeRows(rows: PreviewRow[]): string {
  return JSON.stringify(rows.map(r => [r.code, r.home, r.away, r.date, r.time, r.venueId, r.venueFacilityId ?? '', r.round ?? '', r.pool ?? '']));
}

/**
 * INLINE playoff bracket editor — the single manual editing surface, rendered on
 * the main Schedule screen (not a modal). Build mode (no existing games) shows a
 * starter; edit mode loads the saved bracket into the canvas. Save persists a
 * DIFF via the service-role `save-bracket` action (preserves played-game scores).
 */
export default function BracketEditor({ division, tournamentId, tournament = null, orgSlug, existingGames, canAutoGenerate, onUseAutoGenerator, focusGameId, minRestMinutes = 60, onDone }: Props) {
  // Freeze the division + mode on mount so a mid-edit shift in the page's derived
  // `playoffBuilderDivision` can't retarget the save or flip build/edit mode.
  const [editDivision] = useState(() => division);
  const [isEditMode] = useState(() => existingGames.length > 0);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [templatePreview, setTemplatePreview] = useState<PreviewRow[]>(() => isEditMode ? gamesToBracketPreview(existingGames) : []);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [advancing, setAdvancing] = useState(4);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: 'primary' | 'danger' | 'warning' | 'success' | 'info'; onConfirm?: () => void; confirmText?: string }>({ isOpen: false, title: '', message: '', type: 'primary' });
  // Manual tier setup (build mode). Declared up here so `groupOptions` can read the
  // defined ranges (which include bye seeds absent from any first-round placeholder).
  const [showTierSetup, setShowTierSetup] = useState(false);
  const [tiers, setTiers] = useState<PlayoffTierConfig[]>([]);

  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const isPlayoffOnly = useMemo(() => resolveIsPlayoffOnly(tournament), [tournament]);

  // One bracketId for the whole bracket: the existing single id, else a fresh one.
  // Computed once on mount via a lazy initializer (no ref mutation in render).
  const [bracketId] = useState<string>(() => {
    const ids = Array.from(new Set(existingGames.map(g => g.bracketId).filter(Boolean)));
    return ids.length === 1 ? (ids[0] as string) : crypto.randomUUID();
  });

  // Load accepted teams + venues (existing games came in as a prop).
  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => (r.ok ? r.json() : [])),
      fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).then(r => (r.ok ? r.json() : [])),
    ]).then(([allTeams, vs]) => {
      setTeams((allTeams as Team[]).filter(t => t.divisionId === editDivision.id && t.status === 'accepted'));
      setVenues(vs as Venue[]);
    });
  }, [tournamentId, editDivision.id, orgParam]);

  const seededTeams = useMemo(
    () => (teams.some(t => typeof t.seed === 'number') ? [...teams].sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999)) : teams),
    [teams],
  );
  const resolveSeed = (ref: string): string | null => {
    const m = ref.match(/^Seed #(\d+)$/);
    return m ? (seededTeams[Number(m[1]) - 1]?.id ?? null) : null;
  };
  const labelFor = useMemo<((raw: string) => string) | undefined>(() => {
    if (!isPlayoffOnly) return undefined;
    return (raw: string) => {
      const m = raw.match(/^Seed #(\d+)$/);
      return m ? (seededTeams[Number(m[1]) - 1]?.name ?? raw) : raw;
    };
  }, [isPlayoffOnly, seededTeams]);

  const baseOptions = useMemo(() => Array.from({ length: teams.length }, (_, i) => `Seed #${i + 1}`), [teams.length]);

  // Tiered when any row carries a tier name (loaded multi-bracket, or a manual
  // split). Drives the canvas split + per-tier scheduling/seed scoping.
  const bracketCrossover = useMemo<'reseed' | 'tiers'>(
    () => (templatePreview.some(r => r.pool) || preview.some(r => r.pool) ? 'tiers' : 'reseed'),
    [templatePreview, preview],
  );

  // Per-tier seed dropdown options: each tier offers only its own global seed range,
  // so editing a tier can't pull a seed from another tier. Absent → all seeds (single).
  const groupOptions = useMemo<Record<string, string[]> | undefined>(() => {
    // Manual tiers: use the DEFINED ranges (covers bye seeds absent from any
    // first-round placeholder, e.g. a 3-team tier where the top seed has a bye).
    if (tiers.length > 0) {
      const map: Record<string, string[]> = {};
      for (const t of tiers) {
        map[t.name] = Array.from({ length: t.toSeed - t.fromSeed + 1 }, (_, k) => `Seed #${t.fromSeed + k}`);
      }
      return map;
    }
    // Loaded tiers: derive each tier's range from the Seed #N placeholders present.
    const rows = preview.length ? preview : templatePreview;
    if (!rows.some(r => r.pool)) return undefined;
    const out: Record<string, Set<number>> = {};
    for (const r of rows) {
      if (!r.pool) continue;
      (out[r.pool] ??= new Set<number>());
      for (const ref of [r.home, r.away]) {
        const m = (ref || '').match(/^Seed #(\d+)$/);
        if (m) out[r.pool].add(Number(m[1]));
      }
    }
    const map: Record<string, string[]> = {};
    for (const [pool, seeds] of Object.entries(out)) {
      map[pool] = [...seeds].sort((a, b) => a - b).map(n => `Seed #${n}`);
    }
    return map;
  }, [tiers, preview, templatePreview]);

  const onPreviewChange = useCallback((p: PreviewRow[]) => setPreview(p), []);

  // Dirty = the live canvas differs from what was loaded. Derived (not a flag) so
  // the canvas's multiple mount emissions never produce a false "unsaved" prompt.
  const baseline = useMemo(() => serializeRows(templatePreview), [templatePreview]);
  const dirty = useMemo(() => serializeRows(preview) !== baseline, [preview, baseline]);

  // Scope the feed-order check PER TIER — codes repeat across tiers, so a global
  // check would cross-match "Winner SF1" to the wrong tier's game.
  const violations = useMemo(() => {
    const groups = new Map<string, PreviewRow[]>();
    for (const p of preview) {
      const k = p.pool || '';
      const arr = groups.get(k) ?? groups.set(k, []).get(k)!;
      arr.push(p);
    }
    return [...groups.values()].flatMap(rows =>
      findBracketSchedulingViolations(rows.map(p => ({ code: p.code, home: p.home, away: p.away, date: p.date, time: p.time }))),
    );
  }, [preview]);

  // Live bracket health — same structural read-out as the Plus auto-generator
  // (tightest turnaround, worst-case games/day, longest run), recomputed as the
  // organizer wires/schedules. The inline editor is one reseed bracket (no pools).
  const healthMetrics = useMemo(
    () => preview.length === 0
      ? null
      : buildBracketScheduleMetrics(
          preview.map(p => ({ code: p.code, home: p.home, away: p.away, date: p.date || null, time: p.time || null })),
          { gameDurationMinutes: tournament?.settings?.game_duration_minutes ?? 90, minRestMinutes },
        ),
    [preview, tournament?.settings?.game_duration_minutes, minRestMinutes],
  );
  const violationText = (v: { game: string; feeder: string; reason: string }) =>
    v.reason === 'earlier-date'
      ? `${v.game} is on an earlier day than ${v.feeder}, which feeds it.`
      : `${v.game} must start after ${v.feeder} (same day) — set a later time, or move it to a later day.`;

  function seedFirstRound() {
    const n = Math.max(2, Math.min(advancing, teams.length || advancing));
    const order = seedOrder(nextPow2(n));
    const rows: PreviewRow[] = [];
    let g = 1;
    for (let i = 0; i < order.length; i += 2) {
      const a = order[i];
      const b = order[i + 1];
      if (a <= n && b <= n) {
        rows.push({ round: 'Round 1', code: `R1-${g}`, home: `Seed #${a}`, away: `Seed #${b}`, date: '', time: '', venueId: '' });
        g++;
      }
    }
    setTemplatePreview(rows);
  }
  function startEmpty() { setTemplatePreview([]); }

  // ── Manual tiers (build mode) ──────────────────────────────────────────────
  // Split the division's overall seeds into N contiguous tiers, each its own
  // bracket. Free on every plan (this is the manual surface). Reuses the same
  // tier helpers as the Plus auto-generator so behaviour matches. (showTierSetup +
  // tiers state declared near the top so groupOptions can read the ranges.)
  const tierEligibleCount = teams.length;
  const tierValidation = useMemo(() => validateTierRanges(tiers, tierEligibleCount), [tiers, tierEligibleCount]);

  function openTierSetup() {
    setTiers(suggestDefaultTiers(Math.max(4, tierEligibleCount)));
    setShowTierSetup(true);
  }
  /** Re-derive contiguity: each tier starts right after the previous one ends. */
  function commitTiers(next: PlayoffTierConfig[]) {
    let cursor = 1;
    const normalized = next.map(t => {
      const size = Math.max(2, t.toSeed - t.fromSeed + 1);
      const fromSeed = cursor;
      const toSeed = cursor + size - 1;
      cursor = toSeed + 1;
      return { ...t, fromSeed, toSeed };
    });
    setTiers(normalized);
  }
  function updateTierSize(idx: number, size: number) {
    commitTiers(tiers.map((t, i) => (i === idx ? { ...t, toSeed: t.fromSeed + Math.max(2, size) - 1 } : t)));
  }
  function renameTier(idx: number, name: string) {
    setTiers(tiers.map((t, i) => (i === idx ? { ...t, name } : t)));
  }
  function addTier() {
    const last = tiers[tiers.length - 1];
    const start = last ? last.toSeed + 1 : 1;
    commitTiers([...tiers, { name: `Tier ${tiers.length + 1}`, fromSeed: start, toSeed: start + 1, format: 'single' }]);
  }
  function removeTier(idx: number) {
    if (tiers.length <= 1) return;
    commitTiers(tiers.filter((_, i) => i !== idx));
  }
  /** Seed each tier's first round from its global seed range, tag rows with the
   *  tier name (→ separate bracket + label on save), and load into the canvas. */
  function buildTiers() {
    const v = validateTierRanges(tiers, tierEligibleCount);
    if (!v.ok) {
      setFeedback({ isOpen: true, title: 'Check tier setup', message: v.error ?? 'Tier ranges are invalid.', type: 'warning' });
      return;
    }
    const rows: PreviewRow[] = tiers.flatMap(tier => {
      const n = tier.toSeed - tier.fromSeed + 1;
      const order = seedOrder(nextPow2(n));
      const out: PreviewRow[] = [];
      let g = 1;
      for (let i = 0; i < order.length; i += 2) {
        const a = order[i];
        const b = order[i + 1];
        if (a <= n && b <= n) {
          out.push({
            round: 'Round 1',
            code: `R1-${g}`,
            home: remapTierSeed(`Seed #${a}`, tier.fromSeed),
            away: remapTierSeed(`Seed #${b}`, tier.fromSeed),
            date: '', time: '', venueId: '',
            pool: tier.name,
          });
          g++;
        }
      }
      return out;
    });
    setTemplatePreview(rows);
    setShowTierSetup(false);
  }

  function resolveLocation(p: PreviewRow): string {
    const v = venues.find(d => d.id === p.venueId);
    if (!v) return p.location || '';
    const f = p.venueFacilityId ? v.facilities?.find(fac => fac.id === p.venueFacilityId) : null;
    return f ? `${v.name} — ${f.name}` : v.name;
  }

  async function save() {
    if (preview.length === 0) {
      setFeedback({ isOpen: true, title: 'Nothing to save', message: 'Seed a first round or add at least one game before saving.', type: 'warning' });
      return;
    }
    if (violations.length > 0) {
      setFeedback({ isOpen: true, title: 'Fix the bracket order first', message: violations.map(violationText).join('\n'), type: 'danger' });
      return;
    }
    setLoading(true);
    try {
      // Preserve each existing game's own bracketId + bracketLabel so multi-bracket
      // divisions (tiered / per-pool) don't collapse into one bracket — or lose
      // their tier name — on save.
      const origByGameId = new Map(
        existingGames.map(g => [g.id, { bracketId: g.bracketId, bracketLabel: g.bracketLabel ?? null }]),
      );
      // Map each tier (canvas `pool` name) → its bracketId. Existing tiers keep the
      // real id of their games (so a NEW game added to a tier joins it, and legacy
      // unlabeled tiers shown as "Bracket N" route correctly); brand-new manual tiers
      // get a fresh id each. Ungrouped (single-bracket) rows carry no pool.
      const poolBracketIds: Record<string, string> = {};
      for (const p of preview) {
        if (p.pool && p.sourceGameId && !(p.pool in poolBracketIds)) {
          const id = origByGameId.get(p.sourceGameId)?.bracketId;
          if (id) poolBracketIds[p.pool] = id;
        }
      }
      for (const p of preview) {
        if (p.pool && !(p.pool in poolBracketIds)) poolBracketIds[p.pool] = crypto.randomUUID();
      }
      // A round name is persisted only when the organizer CUSTOMIZED it — i.e. it
      // differs from the auto-derived column title — so untouched rounds stay auto.
      // Key the derived lookup by row INDEX (codes can be empty or duplicated).
      const derivedCols = computeBracketColumns(
        preview.map((p, i) => ({ id: String(i), bracketCode: p.code, homePlaceholder: p.home, awayPlaceholder: p.away })),
      );
      const gameRows = preview.map((p, i) => ({
        sourceGameId: p.sourceGameId,
        roundLabel: (() => {
          const custom = (p.round || '').trim();
          const derived = derivedCols.get(String(i))?.title ?? '';
          return custom && custom !== derived ? custom : null;
        })(),
        // Resolve seeds to teams only for NEW games on playoff-only events (no
        // standings to resolve later). Round-robin leaves them null (advancePlayoffs
        // fills from standings); existing games keep their teams server-side.
        homeTeamId: p.sourceGameId ? undefined : (isPlayoffOnly ? resolveSeed(p.home) : null),
        awayTeamId: p.sourceGameId ? undefined : (isPlayoffOnly ? resolveSeed(p.away) : null),
        date: p.date || null,
        time: p.time || null,
        durationMinutes: tournament?.settings?.game_duration_minutes ?? null,
        location: resolveLocation(p),
        venueId: p.venueId || undefined,
        venueFacilityId: p.venueFacilityId || undefined,
        // Existing rows keep their own real id; new rows join their tier's id (or the
        // single computed id when ungrouped). Label = the tier name when grouped.
        bracketId: p.sourceGameId
          ? ((origByGameId.get(p.sourceGameId)?.bracketId) || (p.pool && poolBracketIds[p.pool]) || bracketId)
          : ((p.pool && poolBracketIds[p.pool]) || bracketId),
        bracketLabel: p.pool ?? (p.sourceGameId ? (origByGameId.get(p.sourceGameId)?.bracketLabel ?? null) : null),
        bracketCode: p.code,
        homePlaceholder: p.home,
        awayPlaceholder: p.away,
      }));
      const res = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-bracket', tournamentId, divisionId: editDivision.id, games: gameRows }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Saving the bracket failed.');
      }
      onDone(true);
    } catch (err) {
      setFeedback({ isOpen: true, title: 'Could not save bracket', message: err instanceof Error ? err.message : 'Saving the bracket failed. Please try again.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    if (!dirty) { onDone(false); return; }
    setFeedback({
      isOpen: true,
      title: 'Discard changes?',
      message: 'Your unsaved bracket edits will be lost.',
      type: 'warning',
      confirmText: 'Discard',
      onConfirm: () => onDone(false),
    });
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '2px', background: 'var(--surface)', margin: '0 0 1rem' }}>
      {/* Sticky action bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <Trophy size={16} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
          <span className="text-label" style={{ color: 'var(--logic-lime)' }}>Editing bracket · {editDivision.name}</span>
          {violations.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f87171', fontSize: '0.75rem', fontWeight: 700 }}>
              <AlertTriangle size={12} /> {violations.length} order issue{violations.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-ghost btn-data" onClick={cancel} disabled={loading}>Cancel</button>
          <button
            type="button"
            className="btn btn-lime btn-data"
            onClick={save}
            disabled={loading || preview.length === 0 || violations.length > 0}
            title={violations.length > 0 ? 'Fix the bracket order — a game is scheduled before the game that feeds it' : undefined}
          >
            {loading ? <><RefreshCw className="spin" size={14} /> Saving…</> : <><Check size={14} /> Save Bracket</>}
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* Starter controls — build mode only */}
        {!isEditMode && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teams in first round</label>
                <NumberStepper value={Math.min(advancing, Math.max(2, teams.length || advancing))} min={2} max={Math.max(2, teams.length || 2)} step={1} onChange={setAdvancing} ariaLabel="Teams in the first round" />
              </div>
              <button type="button" className="btn btn-lime btn-data" onClick={seedFirstRound} disabled={teams.length < 2}>
                <Sparkles size={13} /> Seed first round
              </button>
              <button type="button" className="btn btn-outline btn-data" onClick={openTierSetup} disabled={teams.length < 4} title={teams.length < 4 ? 'Add at least four accepted teams to split into tiers' : 'Split overall seeds into separate tiered brackets (e.g. Gold / Silver)'}>
                <Layers size={13} /> Split into tiers
              </button>
              <button type="button" className="btn btn-ghost btn-data" onClick={startEmpty}>Start empty</button>
              <span style={{ flex: 1 }} />
              {canAutoGenerate && onUseAutoGenerator && (
                <button type="button" className="btn btn-outline btn-data" onClick={onUseAutoGenerator} title="Generate a full bracket from a format (Tournament Plus)">
                  Auto-generate instead
                </button>
              )}
            </div>

            {/* Manual tier setup — split overall seeds into N contiguous tiered brackets */}
            {showTierSetup && (
              <div style={{ marginBottom: '1rem', padding: '1rem 1.1rem', borderRadius: '2px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Layers size={14} style={{ color: 'var(--logic-lime)' }} />
                  <span className="text-label" style={{ color: 'var(--logic-lime)' }}>Tiers — split the {tierEligibleCount} seeds into separate brackets</span>
                </div>
                <p className="text-sm text-muted" style={{ margin: '0 0 0.85rem', maxWidth: '46rem', lineHeight: 1.5 }}>
                  Each tier is its own bracket, seeded from the division&apos;s overall standings (top seeds in the first tier).
                  Set how many teams go in each tier; ranges fill in order.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  {tiers.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={t.name}
                        onChange={e => renameTier(i, e.target.value)}
                        className="form-input"
                        style={{ width: '9rem' }}
                        aria-label={`Tier ${i + 1} name`}
                        maxLength={24}
                      />
                      <span className="text-sm text-muted">Seeds {t.fromSeed}–{t.toSeed}</span>
                      <span style={{ flex: 1 }} />
                      <div className="form-group" style={{ margin: 0 }}>
                        <NumberStepper
                          value={t.toSeed - t.fromSeed + 1}
                          min={2}
                          max={Math.max(2, tierEligibleCount)}
                          step={1}
                          onChange={(val) => updateTierSize(i, val)}
                          ariaLabel={`${t.name} team count`}
                        />
                      </div>
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => removeTier(i)} disabled={tiers.length <= 1} title="Remove tier" style={{ padding: '0.35rem' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {!tierValidation.ok && (
                  <p style={{ margin: '0 0 0.7rem', color: '#f87171', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={12} /> {tierValidation.error}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline btn-data" onClick={addTier}><Plus size={13} /> Add tier</button>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-data" onClick={() => setShowTierSetup(false)}>Cancel</button>
                  <button type="button" className="btn btn-lime btn-data" onClick={buildTiers} disabled={!tierValidation.ok}>
                    <Check size={13} /> Build tiers
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-muted" style={{ margin: '0 0 1rem', maxWidth: '52rem', lineHeight: 1.5 }}>
              Seed a first round (Seed #1 v lowest …), then build each later round by hand: add a round, add matchups, and
              set each side to a <strong>Seed</strong> or the <strong>Winner / Loser</strong> of an earlier game. Lines draw
              as you wire them. Leave dates blank to schedule later — a game cannot be saved on/before a game that feeds it.
              Or <strong>Split into tiers</strong> to seed separate brackets (e.g. Gold / Silver) from the overall standings.
            </p>
          </>
        )}

        {violations.length > 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: '2px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <AlertTriangle size={14} /> A game is scheduled before the game that feeds it
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: 'var(--white-60)', lineHeight: 1.5 }}>
              {violations.map((v, i) => <li key={i}>{violationText(v)}</li>)}
            </ul>
          </div>
        )}

        {healthMetrics && (
          <div style={{ marginBottom: '1rem' }}>
            <BracketHealthPanel
              metrics={healthMetrics}
              title="Bracket Health"
              subtitle={`${editDivision.name} · live as you edit`}
              defaultOpen={false}
            />
          </div>
        )}

        {teams.length < 2 && !isEditMode ? (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <Trophy size={32} />
            <p>Add at least two accepted teams to this division before building a bracket.</p>
          </div>
        ) : (
          <BracketBuilder
            division={editDivision}
            teams={teams}
            venues={venues}
            defaultDate=""
            templatePreview={templatePreview}
            baseOptions={baseOptions}
            groupOptions={groupOptions}
            onPreviewChange={onPreviewChange}
            crossover={bracketCrossover}
            labelFor={labelFor}
            focusSourceGameId={focusGameId}
          />
        )}
      </div>

      <FeedbackModal {...feedback} onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))} />
    </div>
  );
}
