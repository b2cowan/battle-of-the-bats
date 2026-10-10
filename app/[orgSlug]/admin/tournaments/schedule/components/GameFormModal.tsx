'use client';
/**
 * The Add Game / Edit Game window. Moved out of the schedule page as it was (Stage 3 Part 0, a pure move): every
 * value still lives on the page and arrives here under the page's own name. Part 3 replaces it with the game window.
 */
import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, MapPin, X } from 'lucide-react';
import { buildPlaceholderOptions, descendantBracketCodes } from '@/lib/playoff-bracket';
import type { ConflictResult } from '@/lib/schedule-conflict';
import type { Division, Game, PoolSlot, Team, Venue } from '@/lib/types';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
import TournamentFieldPicker from './TournamentFieldPicker';
import ZeroVenuePrompt from './ZeroVenuePrompt';

export type ModalMode = 'add' | 'edit' | null;

export const emptyForm = {
  divisionId: '', homeTeamId: '', awayTeamId: '',
  homeSlotId: '', awaySlotId: '',
  // Playoff bracket participants: a side is either a real team OR a
  // Seed/Winner/Loser placeholder (mutually exclusive).
  homePlaceholder: '', awayPlaceholder: '',
  date: '', time: '09:00', durationMinutes: '' as number | '', location: '', venueId: '', venueFacilityId: '', notes: null as string | null,
};

export type GameForm = typeof emptyForm;

export default function GameFormModal({
  modal, setModal, editing, form, setForm, handleSubmit, fetchModalSlots, divisions, teams, games, modalSlots,
  modalSlotsLoading, viewMode, orgSlug, venues, venueTextMode, setVenueTextMode, hasOrgLibrary, setAddVenueOpen,
  fieldNoun, modalConflict, canAlertFollowers, groupTeams, modalTitleStyle, kx,
}: {
  modal: ModalMode;
  setModal: (mode: ModalMode) => void;
  editing: Game | null;
  form: GameForm;
  setForm: React.Dispatch<React.SetStateAction<GameForm>>;
  handleSubmit: (e: React.FormEvent) => void;
  fetchModalSlots: (divisionId: string) => void;
  divisions: Division[];
  teams: Team[];
  games: Game[];
  modalSlots: PoolSlot[];
  modalSlotsLoading: boolean;
  viewMode: 'pool' | 'playoff';
  orgSlug: string | undefined;
  venues: Venue[];
  venueTextMode: boolean;
  setVenueTextMode: (on: boolean) => void;
  hasOrgLibrary: boolean;
  setAddVenueOpen: (open: boolean) => void;
  fieldNoun: string;
  modalConflict: ConflictResult | null;
  canAlertFollowers: boolean;
  groupTeams: (divisionId: string) => Team[];
  modalTitleStyle: React.CSSProperties;
  /** The page's kit styler, passed down so the move adds no helper call (Part 3 replaces this window). */
  kx: (legacy: React.CSSProperties, kit: React.CSSProperties) => React.CSSProperties;
}) {
  return (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={modalTitleStyle}>
            {modal === 'add' ? 'Add Game' : 'Edit Game'}
          </h3>
          <button className="btn btn-ghost btn-data" onClick={() => setModal(null)}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row form-row-3" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Division *</label>
              <select className="form-select" value={form.divisionId}
                onChange={e => { setForm(f => ({ ...f, divisionId: e.target.value, homeTeamId: '', awayTeamId: '', homeSlotId: '', awaySlotId: '', homePlaceholder: '', awayPlaceholder: '' })); fetchModalSlots(e.target.value); }} required>
                <option value="">Select...</option>
                {divisions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input className="form-input" type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>
          <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Game Length (min)</label>
              <input
                className="form-input"
                type="number"
                min="1" max="600" step="5"
                placeholder="Default"
                value={form.durationMinutes === '' ? '' : form.durationMinutes}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, durationMinutes: v === '' ? '' : (parseInt(v, 10) || '') })); }}
              />
              <small style={kx({ color: 'var(--white-40)', fontSize: '0.75rem' }, KIT_INK.tertiary)}>Leave blank to use the division/event default. Set a value for a longer game (e.g. a final).</small>
            </div>
          </div>
          {(() => {
            if (modalSlotsLoading) {
              return <div style={kx({ marginBottom: '1rem', padding: '0.7rem 0.875rem', fontSize: '0.85rem', color: 'var(--white-40)' }, KIT_INK.tertiary)}>Loading slots…</div>;
            }

            // Playoffs: wire participants by Seed / Winner-of / Loser-of
            // placeholders (or a known team), not pool slots — so a hand-added
            // game connects into the bracket. Options use the canonical strings
            // advancePlayoffs resolves (buildPlaceholderOptions).
            const isPlayoffContext = editing ? !!editing.isPlayoff : viewMode === 'playoff';
            if (isPlayoffContext) {
              const pDiv = divisions.find(g => g.id === form.divisionId);
              const seedCount = pDiv?.playoffConfig?.teamsQualifying || groupTeams(form.divisionId).length || 8;
              // Scope Winner/Loser codes + the single-use "already assigned" set
              // to the SAME bracket group (tier) as the game being edited. Tiers
              // reuse identical codes (QF1, SF1…) and are separated only by
              // bracketId, so a division-wide scope would let one tier's
              // "Winner QF1" hide the other tier's from its dropdown. Only scope
              // when editing a game that already has a bracketId; a brand-new
              // game (no tier yet) keeps the division-wide list.
              const groupId = editing?.bracketId ?? null;
              const sameGroup = (g: Game) => !groupId || g.bracketId === groupId;
              const groupGames = games.filter(g => g.isPlayoff && g.divisionId === form.divisionId && sameGroup(g));
              // Codes at or after the game being edited — its feed-graph
              // descendants — can't feed it: don't offer e.g. "Winner FIN"
              // for a semifinal (the final is fed by that semifinal, so it
              // would be an impossible cycle). New games (no code yet) skip this.
              const blockedCodes = editing?.bracketCode
                ? descendantBracketCodes(editing.bracketCode, groupGames.map(g => ({ code: g.bracketCode || '', refs: [g.homePlaceholder, g.awayPlaceholder] })))
                : new Set<string>();
              const codes = groupGames
                .filter(g => g.bracketCode && g.id !== editing?.id && !blockedCodes.has(g.bracketCode))
                .map(g => g.bracketCode as string);
              const opts = buildPlaceholderOptions(seedCount, codes);
              const dteams = groupTeams(form.divisionId);
              // Each Seed / Winner / Loser feeds exactly one slot: hide refs
              // already wired into another game (and this game's other side).
              // The side's own current value stays selectable for editing.
              const assignedElsewhere = new Set(
                groupGames
                  .filter(g => g.id !== editing?.id)
                  .flatMap(g => [g.homePlaceholder, g.awayPlaceholder])
                  .filter((x): x is string => !!x),
              );
              const setSide = (isHome: boolean, v: string) => {
                const teamId = v.startsWith('team:') ? v.slice(5) : '';
                const ph = v.startsWith('ph:') ? v.slice(3) : '';
                setForm(f => isHome
                  ? { ...f, homeTeamId: teamId, homePlaceholder: ph }
                  : { ...f, awayTeamId: teamId, awayPlaceholder: ph });
              };
              const renderSide = (isHome: boolean, label: string) => {
                const teamId = isHome ? form.homeTeamId : form.awayTeamId;
                const ph = isHome ? form.homePlaceholder : form.awayPlaceholder;
                const otherPh = isHome ? form.awayPlaceholder : form.homePlaceholder;
                const value = teamId ? `team:${teamId}` : ph ? `ph:${ph}` : '';
                const avail = (s: string) => s === ph || (!assignedElsewhere.has(s) && s !== otherPh);
                const seeds = opts.seeds.filter(avail);
                const winners = opts.winners.filter(avail);
                const losers = opts.losers.filter(avail);
                return (
                  <div className="form-group">
                    <label className="form-label">{label}</label>
                    <select className="form-select" value={value} onChange={e => setSide(isHome, e.target.value)}>
                      <option value="">Select…</option>
                      {seeds.length > 0 && (
                        <optgroup label="Seeds">
                          {seeds.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                        </optgroup>
                      )}
                      {winners.length > 0 && (
                        <optgroup label="Winner of…">
                          {winners.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                        </optgroup>
                      )}
                      {losers.length > 0 && (
                        <optgroup label="Loser of…">
                          {losers.map(s => <option key={s} value={`ph:${s}`}>{s}</option>)}
                        </optgroup>
                      )}
                      {dteams.length > 0 && (
                        <optgroup label="Teams">
                          {dteams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                );
              };
              return (
                <>
                  <div style={kx(
                    { marginBottom: '0.75rem', padding: '0.6rem 0.8rem', background: 'var(--white-5)', borderRadius: '2px', fontSize: '0.78rem', color: 'var(--white-40)', lineHeight: 1.5 },
                    { background: 'var(--home-paper)', border: '1px solid var(--home-line)', color: 'var(--text-tertiary)' },
                  )}>
                    Pick a <strong>Seed #</strong> or the <strong>Winner / Loser</strong> of an earlier game. Later rounds can then point at this game&rsquo;s winner automatically.
                  </div>
                  <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                    {renderSide(true, 'Home')}
                    {renderSide(false, 'Away')}
                  </div>
                </>
              );
            }

            const ag = divisions.find(g => g.id === form.divisionId);
            const mPools = ag?.pools ?? [];

            if (modalSlots.length > 0) {
              const slotOptions = mPools.length > 0
                ? mPools.flatMap(pool => {
                    const ps = modalSlots.filter(s => s.poolId === pool.id);
                    return ps.length > 0 ? [{ label: pool.name, slots: ps }] : [];
                  })
                : [{ label: null, slots: modalSlots }];
              const renderSlotSelect = (value: string, onChange: (v: string) => void, label: string) => (
                <div className="form-group">
                  <label className="form-label">{label}</label>
                  <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
                    <option value="">Select slot...</option>
                    {slotOptions.map(({ label: gLabel, slots }) =>
                      gLabel
                        ? <optgroup key={gLabel} label={gLabel}>{slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</optgroup>
                        : slots.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)
                    )}
                  </select>
                </div>
              );
              return (
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  {renderSlotSelect(form.homeSlotId, v => setForm(f => ({ ...f, homeSlotId: v })), 'Home Slot')}
                  {renderSlotSelect(form.awaySlotId, v => setForm(f => ({ ...f, awaySlotId: v })), 'Away Slot')}
                </div>
              );
            }

            return (
              <>
                <div style={kx(
                  { marginBottom: '0.75rem', padding: '0.7rem 0.875rem', background: 'var(--white-5)', borderRadius: '2px', fontSize: '0.8rem', color: 'var(--white-40)' },
                  { background: 'var(--home-paper)', border: '1px solid var(--home-line)', color: 'var(--text-tertiary)' },
                )}>
                  No slots configured for this division. Configure pools in Division Settings to use slot-based scheduling.
                </div>
                <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Home Team</label>
                    <select className="form-select" value={form.homeTeamId} onChange={e => setForm(f => ({ ...f, homeTeamId: e.target.value }))}>
                      <option value="">Select...</option>
                      {groupTeams(form.divisionId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Away Team</label>
                    <select className="form-select" value={form.awayTeamId} onChange={e => setForm(f => ({ ...f, awayTeamId: e.target.value }))}>
                      <option value="">Select...</option>
                      {groupTeams(form.divisionId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
              </>
            );
          })()}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>{fieldNoun}</label>
              <Link
                href={`/${orgSlug}/admin/tournaments/venues`}
                className="btn btn-outline btn-data"
                style={{ height: '26px', fontSize: '0.75rem', padding: '0 0.6rem', gap: '0.25rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                <MapPin size={12} /> Manage venues
              </Link>
            </div>
            {venues.length === 0 && !venueTextMode ? (
              // The state that mints unchecked games: no venues at all. Ask for setup
              // instead of silently accepting text (typing stays possible, one click in).
              <ZeroVenuePrompt
                orgSlug={orgSlug ?? ''}
                hasOrgLibrary={hasOrgLibrary}
                onCreateVenue={() => setAddVenueOpen(true)}
                onTypeAnyway={() => setVenueTextMode(true)}
              />
            ) : (
              <TournamentFieldPicker
                venues={venues}
                noun={fieldNoun}
                value={{ venueId: form.venueId, venueFacilityId: form.venueFacilityId, location: form.location, textMode: venueTextMode }}
                onChange={next => {
                  setVenueTextMode(next.textMode);
                  setForm(f => ({ ...f, venueId: next.venueId, venueFacilityId: next.venueFacilityId, location: next.location }));
                }}
                onCreateVenue={() => setAddVenueOpen(true)}
                selectClassName="form-select"
                inputClassName="form-input"
              />
            )}
          </div>
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label">Notes (optional)</label>
            <input className="form-input" placeholder="Any additional info" value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Venue conflict banner — same danger/warning recipe as the inline row banner
              (GameList.tsx's inlineConflict block, ADC 4b precedent). */}
          {modalConflict && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.7rem 0.875rem',
              borderRadius: '2px',
              background: modalConflict.kind === 'overlap' ? 'rgba(var(--danger-rgb), 0.08)' : 'rgba(var(--warning-rgb), 0.08)',
              border: `1px solid ${modalConflict.kind === 'overlap' ? 'rgba(var(--danger-rgb), 0.3)' : 'rgba(var(--warning-rgb), 0.3)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontWeight: 700, fontSize: '0.82rem', margin: 0,
                    color: modalConflict.kind === 'overlap' ? 'var(--danger-light)' : 'var(--warning-light)',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}>
                    <AlertTriangle size={13} />
                    {modalConflict.kind === 'overlap' ? 'Venue conflict — game windows overlap' : 'Buffer zone warning'}
                  </p>
                  <p style={kx({ fontSize: '0.78rem', color: 'var(--white-60)', margin: '0.3rem 0 0', lineHeight: 1.45 }, KIT_INK.secondary)}>
                    {modalConflict.conflictingDivisionName} already has a game at this venue that{' '}
                    {modalConflict.kind === 'overlap'
                      ? 'physically overlaps this time. Change the time to save.'
                      : 'ends within the required buffer window. You can still save or choose a cleaner slot.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-data"
                  style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                  onClick={() => setForm(f => ({ ...f, time: modalConflict.availableAt }))}
                >
                  Use {modalConflict.availableAt} ↑
                </button>
              </div>
            </div>
          )}

          {/* B2.3 — moving a PUBLISHED game is an outward-facing act, so say so before
              they save. Edit only (a new game announces nothing), scheduled only (a played
              game is bookkeeping), published only (a draft schedule has told nobody
              anything yet). The free-plan variant states the limit plainly; this is the one
              surface where a plan sentence belongs, because the organizer IS the party who
              could buy it — the alert itself never carries an ask. */}
          {(() => {
            if (modal !== 'edit' || !editing) return null;
            if (editing.status && editing.status !== 'scheduled') return null;
            const division = divisions.find(d => d.id === form.divisionId);
            if (division?.scheduleVisibility !== 'published') return null;

            const named = [form.homeTeamId, form.awayTeamId]
              .map(tid => (tid ? teams.find(t => t.id === tid)?.name : null))
              .filter((n): n is string => !!n);
            const who = named.length === 2 ? `${named[0]} and ${named[1]}` : named[0] ?? 'the teams in this game';

            return (
              <div style={kx({
                display: 'flex', gap: '0.55rem', alignItems: 'flex-start',
                margin: '0 0 1rem', padding: '0.7rem 0.875rem', borderRadius: '2px',
                fontSize: '0.8rem', lineHeight: 1.45, color: 'var(--white-60)',
                background: canAlertFollowers ? 'rgba(var(--warning-rgb), 0.10)' : 'var(--white-5)',
                borderLeft: `2px solid ${canAlertFollowers ? 'var(--warning)' : 'var(--white-20)'}`,
              }, {
                color: 'var(--text-secondary)',
                background: canAlertFollowers ? 'rgba(var(--warning-rgb), 0.08)' : 'var(--home-paper)',
                borderLeft: `2px solid ${canAlertFollowers ? 'var(--warning)' : 'var(--home-line-strong)'}`,
              })}>
                <span aria-hidden style={kx({
                  width: '6px', height: '6px', borderRadius: '50%', marginTop: '0.45rem', flex: 'none',
                  background: canAlertFollowers ? 'var(--warning)' : 'var(--white-30)',
                }, {
                  background: canAlertFollowers ? 'var(--warning)' : 'var(--text-tertiary)',
                })} />
                {canAlertFollowers ? (
                  <span>This schedule is published. Saving alerts <strong style={kx({ color: 'var(--white-85)' }, KIT_INK.primary)}>{who}</strong> followers.</span>
                ) : (
                  <span>Teams see this change in the app. <strong style={kx({ color: 'var(--white-85)' }, KIT_INK.primary)}>Phone alerts are a Tournament Plus feature</strong> — on this plan, nobody gets a notification.</span>
                )}
              </div>
            );
          })()}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-data" onClick={() => setModal(null)}>Cancel</button>
            {modalConflict?.kind === 'buffer' ? (
              <>
                {/* #fbbf24 is byte-equal to --warning-light in the admin's plain :root (ADC rule 4)
                    — a straight token swap, not kit-gated (matches GameList.tsx's saveAnywayBtnStyle). */}
                <button type="submit" className="btn btn-outline btn-data" id="schedule-save-btn" style={{ borderColor: 'rgba(var(--warning-rgb), 0.5)', color: 'var(--warning-light)' }}>
                  <Check size={14} /> Save Anyway
                </button>
              </>
            ) : (
              <button
                type="submit"
                className="btn btn-primary btn-data"
                id="schedule-save-btn"
                disabled={modalConflict?.kind === 'overlap'}
                title={modalConflict?.kind === 'overlap' ? 'Resolve the venue conflict before saving' : undefined}
              >
                <Check size={14} /> Save Game
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
