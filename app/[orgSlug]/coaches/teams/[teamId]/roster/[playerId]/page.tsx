'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, AlertTriangle, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import FeedbackModal from '@/components/FeedbackModal';
import PlayerDocumentsSection from '@/components/coaches/PlayerDocumentsSection';
import PlayerDevelopmentSection from '@/components/coaches/PlayerDevelopmentSection';
import { canViewDevelopmentGoals, canViewMeasurables } from '@/lib/coach-capabilities';
import PositionProfileEditor, { type PositionProfileValue } from '@/components/coaches/PositionProfileEditor';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import {
  BATS_OPTIONS, THROWS_OPTIONS, JERSEY_SIZE_OPTIONS,
  BATS_LABELS, THROWS_LABELS, JERSEY_SIZE_LABELS,
} from '@/lib/rep-roster-options';
import styles from '../../../../coaches.module.css';
import type { RepRosterPlayer } from '@/lib/types';
import type { RepPlayerAttendanceSummary, RepPlayerDuesSummary, RepPlayerAwardsSummary } from '@/lib/db';

const ATTN_CHIP: Record<string, string> = {
  attending: styles.badgeActive,
  late:      styles.badgeCompleted,
  absent:    styles.badgeOverdue,
  unknown:   styles.badgeDraft,
};
const ATTN_LABEL: Record<string, string> = {
  attending: 'Present', late: 'Late', absent: 'Absent', unknown: '—',
};

function formatShortDate(s: string): string {
  if (!s) return '';
  const iso = s.length === 10 ? `${s}T00:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

const STATUS_CSS: Record<string, string> = {
  active:   styles.badgeActive,
  inactive: styles.badgeDraft,
};

interface EditForm {
  playerFirstName: string; playerLastName: string;
  playerDateOfBirth: string; playerNumber: string;
  positions: PositionProfileValue;
  pitcher: { isPitcher: boolean; rank: number; maxInnings: string }; // maxInnings '' = no cap
  aSquad: boolean; // P4: gold-medal starter — protected from the bench in competitive games
  guardianFirstName: string; guardianLastName: string;
  guardianEmail: string; guardianPhone: string;
  notes: string;
  medicalNotes: string; emergencyContactName: string; emergencyContactPhone: string;
  bats: string; throws: string; jerseySize: string;
}

// Legacy/migrated data sometimes stored the literal word "null"/"undefined" as text.
// Treat those as empty so they never display or get re-saved.
function clean(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  return s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' ? '' : (v ?? '');
}

function playerToForm(p: RepRosterPlayer, pitcherPos: string | null): EditForm {
  return {
    playerFirstName:   clean(p.playerFirstName),
    playerLastName:    clean(p.playerLastName),
    playerDateOfBirth: p.playerDateOfBirth ?? '',
    playerNumber:      clean(p.playerNumber),
    positions:         (() => { const prefs = playerPositionPrefs(p, pitcherPos); return { best: prefs.preferred, okay: prefs.canPlay, never: prefs.never }; })(),
    pitcher:           (() => { const pit = p.lineupProfile?.pitcher; return { isPitcher: !!pit, rank: pit?.rank ?? 1, maxInnings: pit?.maxInnings != null ? String(pit.maxInnings) : '' }; })(),
    aSquad:            p.lineupProfile?.aSquad ?? false,
    guardianFirstName: clean(p.guardianFirstName),
    guardianLastName:  clean(p.guardianLastName),
    guardianEmail:     clean(p.guardianEmail),
    guardianPhone:     clean(p.guardianPhone),
    notes:             clean(p.notes),
    medicalNotes:          clean(p.medicalNotes),
    emergencyContactName:  clean(p.emergencyContactName),
    emergencyContactPhone: clean(p.emergencyContactPhone),
    bats:        p.bats ?? '',
    throws:      p.throws ?? '',
    jerseySize:  p.jerseySize ?? '',
  };
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  // Parse the YYYY-MM-DD as a LOCAL date — `new Date('2017-01-02')` is UTC midnight,
  // which shifts the day (and the birthday) back one in western-hemisphere timezones.
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const birth = new Date(y, m - 1, d);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const mm = now.getMonth() - birth.getMonth();
  if (mm < 0 || (mm === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

// Season labels are often auto-named with the team in them — strip a leading
// team-name prefix so the subtitle doesn't repeat the team name.
function seasonLabel(season: string | null | undefined, teamName: string): string {
  const s = (season ?? '').trim();
  if (!s) return '';
  const t = teamName.trim();
  if (t && s.toLowerCase().startsWith(t.toLowerCase())) {
    const stripped = s.slice(t.length).replace(/^[\s—–-]+/, '').trim();
    if (stripped) return stripped;
  }
  return s;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; playerId: string }>;
}) {
  const { orgSlug, teamId, playerId } = use(params);
  const { assignments, loading: assignmentsLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  // Positions/pitching vocabulary comes from this team's sport (falls back to the default until the
  // assignment loads). The picker offers the assignable FIELD positions (not the OF catch-all / DH).
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const pitcherPos = sportPack.pitcherPosition; // e.g. 'P'; null when the sport has no mound

  const [player, setPlayer] = useState<RepRosterPlayer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [attendance, setAttendance] = useState<RepPlayerAttendanceSummary | null>(null);
  const [dues, setDues] = useState<RepPlayerDuesSummary | null>(null);
  const [awards, setAwards] = useState<RepPlayerAwardsSummary | null>(null);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load player');
      setPlayer(data.player);
      setForm(playerToForm(data.player, pitcherPos));
      setAttendance(data.attendance ?? null);
      setDues(data.dues ?? null);
      setAwards(data.awards ?? null);
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to load.'));
    } finally {
      setFetching(false);
    }
  }, [orgSlug, teamId, playerId, pitcherPos]);

  useEffect(() => { if (!assignmentsLoading) void Promise.resolve().then(load); }, [assignmentsLoading, load]);

  // Compare against the cleaned baseline (playerToForm) — not the raw player — so a
  // legacy literal "null"/"undefined" value doesn't show a phantom "unsaved changes" on load.
  const isDirty = !!(player && form && JSON.stringify(form) !== JSON.stringify(playerToForm(player, pitcherPos)));

  async function handleSave() {
    if (!form || !player) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerFirstName:    form.playerFirstName.trim(),
            playerLastName:     form.playerLastName.trim() || null,
            playerDateOfBirth:  form.playerDateOfBirth || null,
            playerNumber:       form.playerNumber.trim() || null,
            // Best/Okay/Never picker + Pitching section: the server derives primary/secondary + the
            // stored profile. A-squad (P4) is carried through untouched until that phase ships.
            lineupProfile: {
              preferred: form.positions.best,
              canPlay: form.positions.okay,
              never: form.positions.never,
              pitcher: pitcherPos && form.pitcher.isPitcher
                ? { rank: form.pitcher.rank, maxInnings: form.pitcher.maxInnings.trim() === '' ? null : Number(form.pitcher.maxInnings) }
                : null,
              aSquad: form.aSquad,
            },
            guardianFirstName:  form.guardianFirstName.trim() || null,
            guardianLastName:   form.guardianLastName.trim() || null,
            guardianEmail:      form.guardianEmail.trim() || null,
            guardianPhone:      form.guardianPhone.trim() || null,
            notes:              form.notes.trim() || null,
            medicalNotes:          form.medicalNotes.trim() || null,
            emergencyContactName:  form.emergencyContactName.trim() || null,
            emergencyContactPhone: form.emergencyContactPhone.trim() || null,
            bats:        form.bats || null,
            throws:      form.throws || null,
            jerseySize:  form.jerseySize || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setPlayer(data.player);
      setForm(playerToForm(data.player, pitcherPos));
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!player) return;
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    setTogglingStatus(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/roster/${playerId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setPlayer(data.player);
      setForm(playerToForm(data.player, pitcherPos));
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to update status.'));
    } finally {
      setTogglingStatus(false);
    }
  }

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  if (assignmentsLoading || fetching) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }
  if (!player || !form) return <p className={styles.muted}>Player not found.</p>;

  // The mound is never a fielding chip — pitching is set only in the Pitching section below. The
  // chips are the field positions minus the mound.
  const pickerPositions = pitcherPos
    ? sportPack.fieldPositions.filter(p => p !== pitcherPos)
    : sportPack.fieldPositions;

  const attnKnown = attendance ? attendance.attending + attendance.absent + attendance.late : 0;
  const attnRate = attnKnown > 0 ? Math.round((attendance!.attending / attnKnown) * 100) : 0;

  return (
    <div className={styles.page}>
      <UnsavedChangesGuard active={isDirty} />
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`/${orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={base}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/roster`}>Roster</Link>
        <span><ChevronRight size={12} /></span>
        <span>{[clean(player.playerFirstName), clean(player.playerLastName)].filter(Boolean).join(' ')}</span>
      </div>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>{[clean(player.playerFirstName), clean(player.playerLastName)].filter(Boolean).join(' ')}</h1>
            <p className={styles.pageSub}>
              {[
                player.playerNumber ? `#${player.playerNumber}` : null,
                ageFromDob(player.playerDateOfBirth) !== null ? `Age ${ageFromDob(player.playerDateOfBirth)}` : null,
                seasonLabel(assignment.programYearName, assignment.teamName)
                  ? `${seasonLabel(assignment.programYearName, assignment.teamName)} season` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      {/* Status row */}
      <div className={styles.statusRow}>
        <span className={styles.statusLabel}>Status</span>
        <span className={`${styles.badge} ${STATUS_CSS[player.status] ?? styles.badgeDraft}`}>
          {player.status === 'active' ? 'Active' : 'Inactive'}
        </span>
        {player.medicalNotes && (
          <span className={styles.medicalFlag} title="This player has medical notes on file">
            <AlertTriangle size={12} /> Medical info
          </span>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.82rem', marginLeft: 'auto', opacity: togglingStatus ? 0.5 : 1 }}
          disabled={togglingStatus}
          onClick={handleToggleStatus}
        >
          {togglingStatus ? '…' : player.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {/* Player info */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Player</p>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pfn">First Name</label>
            <input id="pfn" className={styles.input} type="text"
              value={form.playerFirstName}
              onChange={e => setForm(f => f ? { ...f, playerFirstName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pln">Last Name</label>
            <input id="pln" className={styles.input} type="text"
              value={form.playerLastName}
              onChange={e => setForm(f => f ? { ...f, playerLastName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pdob">Date of Birth</label>
            <input id="pdob" className={styles.input} type="date"
              value={form.playerDateOfBirth}
              onChange={e => setForm(f => f ? { ...f, playerDateOfBirth: e.target.value } : f)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pnum">Jersey #</label>
            <input id="pnum" className={styles.input} type="text"
              value={form.playerNumber}
              onChange={e => setForm(f => f ? { ...f, playerNumber: e.target.value } : f)}
              maxLength={10} />
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Positions</label>
            <PositionProfileEditor
              positions={pickerPositions}
              value={form.positions}
              onChange={next => setForm(f => f ? { ...f, positions: next } : f)} />
          </div>
          {pitcherPos && (
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label}>Pitching</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', color: 'var(--home-ink, rgba(255,255,255,0.85))' }}>
                <input type="checkbox" checked={form.pitcher.isPitcher}
                  onChange={e => { const on = e.target.checked; setForm(f => f ? { ...f, pitcher: { ...f.pitcher, isPitcher: on } } : f); }} />
                <span>This player pitches</span>
              </label>
              {form.pitcher.isPitcher && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
                  <div style={{ minWidth: 150 }}>
                    <label className={styles.label} htmlFor="pitcher-rank">Pitcher rank</label>
                    <select id="pitcher-rank" className={styles.select}
                      value={form.pitcher.rank}
                      onChange={e => setForm(f => f ? { ...f, pitcher: { ...f.pitcher, rank: Number(e.target.value) } } : f)}>
                      <option value={1}>1 — Ace</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </div>
                  <div style={{ minWidth: 150 }}>
                    <label className={styles.label} htmlFor="pitcher-max">Max innings / game</label>
                    <input id="pitcher-max" className={styles.input} type="number" min={1} max={20}
                      placeholder="No limit"
                      value={form.pitcher.maxInnings}
                      onChange={e => setForm(f => f ? { ...f, pitcher: { ...f.pitcher, maxInnings: e.target.value } } : f)} />
                  </div>
                </div>
              )}
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                Guides the game-day Auto-fill: competitive games lead with your ace; balanced &amp; development games spread innings down the order. Auto-fill never exceeds the max-innings cap.
              </p>
            </div>
          )}
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>A-squad</label>
            {/* Gold-medal star (P5) — same treatment as the Depth-chart board so the two surfaces match. */}
            <button type="button" aria-pressed={form.aSquad}
              onClick={() => setForm(f => f ? { ...f, aSquad: !f.aSquad } : f)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span aria-hidden style={{
                fontSize: 26, lineHeight: 1, transition: '0.12s',
                color: form.aSquad ? 'var(--gold)' : 'var(--home-dim, rgba(255,255,255,0.45))',
                textShadow: form.aSquad ? '0 0 12px rgba(var(--gold-rgb),0.4)' : 'none',
              }}>★</span>
              <span style={{ fontSize: 14, color: 'var(--home-ink, rgba(255,255,255,0.85))' }}>Gold-medal starter{form.aSquad ? '' : ' — tap to mark'}</span>
            </button>
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
              In <strong>competitive</strong> games, A-squad players get their best positions and are protected from the bench. No effect on balanced or development games.
            </p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="bats">Bats</label>
            <select id="bats" className={styles.select} value={form.bats}
              onChange={e => setForm(f => f ? { ...f, bats: e.target.value } : f)}>
              <option value="">—</option>
              {BATS_OPTIONS.map(o => <option key={o} value={o}>{BATS_LABELS[o]}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="throws">Throws</label>
            <select id="throws" className={styles.select} value={form.throws}
              onChange={e => setForm(f => f ? { ...f, throws: e.target.value } : f)}>
              <option value="">—</option>
              {THROWS_OPTIONS.map(o => <option key={o} value={o}>{THROWS_LABELS[o]}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="jersey-size">Jersey Size</label>
            <select id="jersey-size" className={styles.select} value={form.jerseySize}
              onChange={e => setForm(f => f ? { ...f, jerseySize: e.target.value } : f)}>
              <option value="">—</option>
              {JERSEY_SIZE_OPTIONS.map(o => <option key={o} value={o}>{JERSEY_SIZE_LABELS[o]}</option>)}
            </select>
          </div>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label} htmlFor="pnotes">Notes (private)</label>
            <textarea id="pnotes" className={styles.textarea} rows={3}
              value={form.notes}
              onChange={e => setForm(f => f ? { ...f, notes: e.target.value } : f)}
              placeholder="Private notes for your coaching staff — not visible to families"
              maxLength={1000} />
          </div>
        </div>
      </div>

      {/* Guardian info */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Guardian</p>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gfn">First Name</label>
            <input id="gfn" className={styles.input} type="text"
              value={form.guardianFirstName}
              onChange={e => setForm(f => f ? { ...f, guardianFirstName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gln">Last Name</label>
            <input id="gln" className={styles.input} type="text"
              value={form.guardianLastName}
              onChange={e => setForm(f => f ? { ...f, guardianLastName: e.target.value } : f)}
              maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gem">Email</label>
            <input id="gem" className={styles.input} type="email"
              value={form.guardianEmail}
              onChange={e => setForm(f => f ? { ...f, guardianEmail: e.target.value } : f)}
              maxLength={120} />
            {form.guardianEmail.trim() && (
              <a className={styles.contactLink} href={`mailto:${form.guardianEmail.trim()}`}>Email guardian</a>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="gph">Phone</label>
            <input id="gph" className={styles.input} type="tel"
              value={form.guardianPhone}
              onChange={e => setForm(f => f ? { ...f, guardianPhone: e.target.value } : f)}
              maxLength={20} />
            {form.guardianPhone.trim() && (
              <a className={styles.contactLink} href={`tel:${form.guardianPhone.replace(/[^\d+]/g, '')}`}>Call or text</a>
            )}
          </div>
        </div>
      </div>

      {/* Safety */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Safety</p>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label} htmlFor="medical">Allergies / medical notes</label>
            <textarea id="medical" className={styles.textarea} rows={2}
              value={form.medicalNotes}
              onChange={e => setForm(f => f ? { ...f, medicalNotes: e.target.value } : f)}
              placeholder="Allergies, conditions, medications — visible to coaching staff"
              maxLength={1000} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ecn">Emergency contact name</label>
            <input id="ecn" className={styles.input} type="text"
              value={form.emergencyContactName}
              onChange={e => setForm(f => f ? { ...f, emergencyContactName: e.target.value } : f)}
              maxLength={80} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="ecp">Emergency contact phone</label>
            <input id="ecp" className={styles.input} type="tel"
              value={form.emergencyContactPhone}
              onChange={e => setForm(f => f ? { ...f, emergencyContactPhone: e.target.value } : f)}
              maxLength={20} />
            {form.emergencyContactPhone.trim() && (
              <a className={styles.contactLink} href={`tel:${form.emergencyContactPhone.replace(/[^\d+]/g, '')}`}>Call</a>
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className={styles.detailSection}>
        <PlayerDocumentsSection
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
        />
      </div>

      {/* Development (Player Development 3A) — section renders only when this coach can see
          goals (notes) or measurables (roster view); the API filters server-side regardless. */}
      {assignment && (canViewDevelopmentGoals(assignment.capabilities) || canViewMeasurables(assignment.capabilities)) && (
        <div className={styles.detailSection}>
          {/* key forces a fresh mount per player — no cross-player fetch races or stale drafts */}
          <PlayerDevelopmentSection
            key={playerId}
            orgSlug={orgSlug}
            teamId={teamId}
            playerId={playerId}
            bestPositions={form?.positions.best ?? []}
            attendancePct={attendance && attnKnown > 0 ? attnRate : null}
            playerName={[clean(player.playerFirstName), clean(player.playerLastName)].filter(Boolean).join(' ')}
            playerNumber={player.playerNumber ? clean(player.playerNumber) : null}
            teamName={assignment.teamName}
            seasonName={seasonLabel(assignment.programYearName, assignment.teamName) || null}
          />
        </div>
      )}

      {/* Attendance */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Attendance</p>
        {!attendance || attendance.total === 0 ? (
          <p className={styles.detailPlaceholder}>No attendance recorded yet this season.</p>
        ) : (
          <>
            <div className={styles.statStrip}>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attnRate}%</span><span className={styles.statBoxLabel}>Attendance</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attendance.attending}</span><span className={styles.statBoxLabel}>Present</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attendance.late}</span><span className={styles.statBoxLabel}>Late</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attendance.absent}</span><span className={styles.statBoxLabel}>Absent</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attendance.total}</span><span className={styles.statBoxLabel}>Recorded</span></div>
            </div>
            {attendance.recent.length > 0 && (
              <>
                <p className={styles.miniListLabel}>Last {attendance.recent.length} sessions</p>
                <ul className={styles.miniList}>
                  {attendance.recent.map(r => (
                    <li key={r.eventId} className={styles.miniRow}>
                      <span className={styles.miniRowMain}>{r.name}</span>
                      <span className={styles.miniRowMeta}>{formatShortDate(r.startsAt)}</span>
                      <span className={`${styles.badge} ${ATTN_CHIP[r.status] ?? styles.badgeDraft}`}>{ATTN_LABEL[r.status] ?? r.status}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Awards */}
      <div className={styles.detailSection}>
        <p className={styles.detailSectionTitle}>Awards</p>
        {!awards || awards.total === 0 ? (
          <p className={styles.detailPlaceholder}>No awards yet this season.</p>
        ) : (
          <>
            <p className={styles.miniListLabel} style={{ marginTop: 0 }}>
              🏆 {awards.total} award{awards.total === 1 ? '' : 's'} this season
            </p>
            <ul className={styles.miniList}>
              {awards.byType.map(t => (
                <li key={t.awardTypeId} className={styles.miniRow}>
                  <span className={styles.miniRowMain}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</span>
                  <span className={styles.miniRowMeta}>{t.count}×</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Dues */}
      <div className={styles.detailSection}>
        <div className={styles.sectionHeadRow}>
          <p className={styles.detailSectionTitle} style={{ margin: 0 }}>Dues</p>
          <Link href={`${base}/accounting/dues`} className={styles.contactLink} style={{ marginTop: 0 }}>Manage dues →</Link>
        </div>
        {!dues || !dues.hasSchedule ? (
          <p className={styles.detailPlaceholder}>No dues set for this player this season.</p>
        ) : (
          <>
            <div className={styles.statStrip}>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{money(dues.totalAssessed)}</span><span className={styles.statBoxLabel}>Assessed</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{money(dues.totalPaid)}</span><span className={styles.statBoxLabel}>Paid</span></div>
              {dues.totalCredits > 0 && (
                <div className={styles.statBox}><span className={styles.statBoxValue}>{money(dues.totalCredits)}</span><span className={styles.statBoxLabel}>Credits</span></div>
              )}
              <div className={styles.statBox}>
                <span className={styles.statBoxValue} data-tone={dues.balance > 0 ? 'danger' : 'good'}>{money(dues.balance)}</span>
                <span className={styles.statBoxLabel}>Balance</span>
              </div>
            </div>
            <p className={styles.miniListLabel}>
              {dues.paidInstallmentCount}/{dues.installmentCount} installments paid
              {dues.overdue ? ' · overdue' : dues.nextDueDate ? ` · next due ${formatShortDate(dues.nextDueDate)}` : ''}
            </p>
          </>
        )}
      </div>

      {/* Save bar — viewport-pinned while there are unsaved changes, no matter where you scroll.
          The spacer reserves scroll room so the bar never covers the last card. */}
      {(isDirty || savedFlash) && <div aria-hidden className={styles.saveBarSpacer} />}
      {(isDirty || savedFlash) && (
        <div className={styles.saveBar} role="region" aria-label="Unsaved changes">
          <div className={styles.saveBarInner}>
            <span className={`${styles.saveBarStatus} ${savedFlash && !isDirty ? styles.saveBarStatusSaved : ''}`}>
              {savedFlash && !isDirty
                ? <><Check size={15} /> Saved</>
                : <><span className={styles.saveDot} /> Unsaved changes</>}
            </span>
            {isDirty && (
              <div className={styles.saveBarActions}>
                <button type="button" className="btn btn-ghost" disabled={saving}
                  onClick={() => setForm(playerToForm(player, pitcherPos))}>
                  Discard
                </button>
                <button type="button" className="btn btn-lime" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'}
        message={feedbackMsg}
        type={feedbackType}
      />
    </div>
  );
}
