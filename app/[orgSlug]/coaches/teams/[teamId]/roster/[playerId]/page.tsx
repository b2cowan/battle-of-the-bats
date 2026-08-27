'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, Check } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { stripTeamNamePrefix } from '@/lib/coach-season-label';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachCollapseSection from '@/components/coaches/CoachCollapseSection';
import FeedbackModal from '@/components/FeedbackModal';
import PlayerDocumentsSection from '@/components/coaches/PlayerDocumentsSection';
import PlayerGuardiansCard from '@/components/coaches/PlayerGuardiansCard';
import PlayerDevelopmentSection from '@/components/coaches/PlayerDevelopmentSection';
import PlayerRecapPreview from '@/components/coaches/PlayerRecapPreview';
import { canViewDevelopmentGoals, canViewMeasurables, canViewPlayerDocuments, canManagePlayerDocuments } from '@/lib/coach-capabilities';
import PositionProfileEditor, { type PositionProfileValue } from '@/components/coaches/PositionProfileEditor';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import {
  BATS_OPTIONS, THROWS_OPTIONS, JERSEY_SIZE_OPTIONS,
  BATS_LABELS, THROWS_LABELS, JERSEY_SIZE_LABELS,
} from '@/lib/rep-roster-options';
import { formatInOrgZone } from '@/lib/timezone';
import { moneySectionHref } from '@/lib/coach-money-links';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import type { RepRosterPlayer, RepTeamGameMoment } from '@/lib/types';
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

/* ⚠ THREE TABS, NOT NINE DRAWERS (owner ruling 2026-08-26). The page was a flat stack of equal
   collapsible sections ordered by the data model — Player, Guardian contact, Safety, Guardians,
   Documents, Development, Attendance, Awards, Dues — which made two different pages wear one coat:
   a FORM filled in once in April, and a RECORD read all season. Stacked flat, the thing a coach
   reads weekly sat under the thing they typed once, and a phone number could be in any of three
   places. The tabs map to the three reasons anyone opens a player: how are they doing, what did I
   mistype, who do I call.
   ⚠ "This season" is the default because that is the mid-season question; a coach who has just
   added someone is already on their way to Details. */
/* ⚠ TWO LABELS EACH, AND THE SHORT ONE IS NOT AN AFTERTHOUGHT. At 390px the three full labels
   run past the right edge and "Family & paperwork" is cut mid-word — a rail that looks broken
   rather than one that scrolls. The phone gets the short forms; every other width gets the words. */
const PLAYER_TABS = [
  { id: 'season',  label: 'This season',        short: 'Season' },
  { id: 'details', label: 'Details',            short: 'Details' },
  { id: 'family',  label: 'Family & paperwork', short: 'Family' },
] as const;
type PlayerTab = typeof PLAYER_TABS[number]['id'];

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
  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all.
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  // Positions/pitching vocabulary comes from this team's sport (falls back to the default until the
  // assignment loads). The picker offers the assignable FIELD positions (not the OF catch-all / DH).
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const pitcherPos = sportPack.pitcherPosition; // e.g. 'P'; null when the sport has no mound

  const [player, setPlayer] = useState<RepRosterPlayer | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [tab, setTab] = useState<PlayerTab>('season');
  const confirm = useConfirm();
  const [attendance, setAttendance] = useState<RepPlayerAttendanceSummary | null>(null);
  const [dues, setDues] = useState<RepPlayerDuesSummary | null>(null);
  const [awards, setAwards] = useState<RepPlayerAwardsSummary | null>(null);
  /** Game-Day P2 — the bench moments tagged to this player. Coach-side only, live season only;
   *  the route sends an empty list otherwise, so this block simply doesn't render. */
  const [moments, setMoments] = useState<{ moments: RepTeamGameMoment[]; total: number }>(
    { moments: [], total: 0 },
  );
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
      setMoments(data.moments ?? { moments: [], total: 0 });
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

  /* ⚠ THIS IS THE DELETE, AND IT NOW SAYS SO (owner ruling 2026-08-26). There is no hard delete in
     the coach portal — taking a player off a team IS this write — and until now it was an unguarded
     ghost button sitting directly under the child's name, and another on every row of the roster
     list. The confirmation states the CONSEQUENCE rather than the state: "inactive" means nothing
     to a coach, whereas "stops appearing in lineups, attendance, dues and team emails" is the
     actual effect, and "everything recorded is kept" is the reassurance that makes it a decision
     rather than a gamble.
     ⚠ Putting someone BACK is not guarded — it restores, it does not destroy. */
  async function handleToggleStatus() {
    if (!player) return;
    const newStatus = player.status === 'active' ? 'inactive' : 'active';
    if (newStatus === 'inactive') {
      const firstName = clean(player.playerFirstName) || 'this player';
      const ok = await confirm({
        title: `Take ${firstName} off the roster?`,
        message: 'They stop appearing in lineups, attendance, dues and team emails. '
          + 'Everything already recorded is kept, and you can put them back any time.',
        confirmText: 'Take off the roster',
        cancelText: 'Keep on the roster',
        tone: 'danger',
      });
      if (!ok) return;
    }
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

  if (assignmentsLoading || fetching) return <CoachLoading label="Loading this player…" />;
  if (!page.hasAccess) {
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
  const age = player ? ageFromDob(player.playerDateOfBirth) : null;
  const bestPositions = form?.positions.best ?? [];
  const canWriteRoster = !!page.capabilities?.rosterWrite;
  const guardianName = player
    ? [player.guardianFirstName, player.guardianLastName].filter(Boolean).join(' ').trim()
    : '';

  return (
    <div className={styles.page}>
      <UnsavedChangesGuard active={isDirty} />
      {/* Header (page-header ruling 2026-08-11): the player's name + archive chip, nothing
          under the title — jersey number and age are live facts, so they lead the status row
          the page already had one line down. Season text is the masthead's job.
          The way back is the ARROW in this header's leading corner (amendment 2026-08-26); the
          blue row that used to stand above it is gone, and the child's name moved up with it. */}
      <CoachPageHeader
        icon={Users}
        title={[clean(player.playerFirstName), clean(player.playerLastName)].filter(Boolean).join(' ')}
        backTo={{ href: `${base}/roster`, label: 'Roster' }}
      />

      {/* ⚠ THE PLAYER, BEFORE THE FORM (owner ruling 2026-08-26). What stood here was a "Status"
          strip whose first control, directly under a child's name, was the delete — and whose badge
          read ACTIVE on every player who has ever been looked at, because that is the default.
          It is replaced by what someone actually opens a player to find out. Removal moved to the
          foot of Details, where a destructive act belongs and where it is named for what it does.
          ⚠ Off the roster is the ONE state worth stating, so it is the only badge here. */}
      <div className={styles.playerGlance}>
        <div className={styles.playerGlanceChips}>
          {player.status !== 'active' && (
            <span className={`${styles.badge} ${styles.badgeDraft}`}>Off the roster</span>
          )}
          {player.playerNumber && <span className={styles.playerGlanceJersey}>#{clean(player.playerNumber)}</span>}
          {bestPositions.length > 0 && <span className={styles.chipQuiet}>{bestPositions.join(' / ')}</span>}
          {player.lineupProfile?.aSquad && <span className={styles.chipQuiet}>A-squad</span>}
          {player.lineupProfile?.pitcher && (
            <span className={styles.chipQuiet}>Pitcher · rank {player.lineupProfile.pitcher.rank}</span>
          )}
          {age !== null && <span className={styles.chipQuiet}>Age {age}</span>}
          {player.medicalNotes && (
            <span className={styles.chipDanger} title="This player has medical notes on file">
              <AlertTriangle size={11} /> Medical notes
            </span>
          )}
        </div>

        {/* ⚠ FOUR TILES, ALL FROM DATA THIS PAGE HAS ALREADY FETCHED — no extra call for a summary.
            ⚠ There is deliberately no "documents outstanding" tile: nothing in the product records
            which documents a team REQUIRES, and a tile that invented that number would be inventing
            a policy. Documents live on the Family & paperwork tab, where they can be counted
            honestly. */}
        <div className={styles.playerGlanceTiles}>
          <div className={styles.playerTile}>
            <span className={styles.playerTileKey}>Dues</span>
            <span className={styles.playerTileValue}
              data-tone={dues?.hasSchedule && dues.balance > 0 ? 'danger' : undefined}>
              {!dues?.hasSchedule ? 'None set' : dues.balance > 0 ? money(dues.balance) : 'Paid'}
            </span>
            <span className={styles.playerTileFoot}>
              {dues?.hasSchedule
                ? `${dues.paidInstallmentCount}/${dues.installmentCount} installments paid`
                : 'No dues this season'}
            </span>
          </div>
          <div className={styles.playerTile}>
            <span className={styles.playerTileKey}>Attendance</span>
            <span className={styles.playerTileValue}>{attnKnown > 0 ? `${attnRate}%` : '—'}</span>
            <span className={styles.playerTileFoot}>
              {attendance && attendance.total > 0
                ? `${attendance.total} recorded`
                : 'Nothing recorded yet'}
            </span>
          </div>
          <div className={styles.playerTile}>
            <span className={styles.playerTileKey}>Family</span>
            <span className={styles.playerTileValue}>{guardianName || 'No contact'}</span>
            <span className={styles.playerTileFoot}>
              {player.guardianEmail || player.guardianPhone || 'Add one on Family & paperwork'}
            </span>
          </div>
          <div className={styles.playerTile}>
            <span className={styles.playerTileKey}>Awards</span>
            <span className={styles.playerTileValue}>{awards?.total ?? 0}</span>
            <span className={styles.playerTileFoot}>this season</span>
          </div>
        </div>
      </div>

      <div className={styles.playerTabs} role="tablist" aria-label="Player record">
        {PLAYER_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.playerTab}${tab === t.id ? ' ' + styles.playerTabOn : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className={styles.playerTabLong}>{t.label}</span>
            <span className={styles.playerTabShort}>{t.short}</span>
          </button>
        ))}
      </div>

      {/* ⚠ THIS PAGE WAS TWO COLUMNS UNTIL 2026-08-13 (D3, 2026-08-01): a main column of collapsible
          sections plus a 300px quick-facts rail. The rail is gone at owner ruling — on a 960px
          reading measure it was taking 300 of them, so the form it sat beside was being squeezed
          into ~635px to make room for fields that then had to be squeezed again to fit the rail.
          Everything it held MOVED here; nothing was dropped. See the guardian/safety sections
          directly below and the Dues section at the foot of the page. */}
      {/* ── DETAILS: the form filled in once, in April ───────────────────────────────────
          ⚠ The sections keep their own disclosures. A tab groups; a disclosure orders WITHIN a
          group, and the coach's collapse state is already remembered per section — throwing that
          away to prove a point about nesting would cost more than it buys. */}
      {tab === 'details' && (<>
      <CoachCollapseSection sectionId="player" title="Player">
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
      </CoachCollapseSection>

      {/* ⚠ THE REMOVAL LIVES HERE — at the FOOT of the form, not the top of the page (owner
          ruling 2026-08-26). It is the delete: there is no hard delete in the coach portal, and an
          inactive player disappears from lineups, attendance, dues, team emails and every report.
          A destructive act belongs at the end of the thing it destroys, named for its effect, and
          behind a question. It was a ghost button under a child's name.
          ⚠ Head coach (or an assistant granted roster-write) only — the API refuses everyone else,
          and a control that always fails is worse than no control. */}
      {canWriteRoster && (
        <div className={styles.playerDangerZone}>
          <div className={styles.playerDangerCopy}>
            <p className={styles.playerDangerTitle}>
              {player.status === 'active'
                ? `Take ${clean(player.playerFirstName) || 'this player'} off the roster`
                : `Put ${clean(player.playerFirstName) || 'this player'} back on the roster`}
            </p>
            <p className={styles.detailPlaceholder} style={{ marginTop: 0 }}>
              {player.status === 'active'
                ? 'They stop appearing in lineups, attendance, dues and team emails. Everything already recorded is kept, and you can put them back any time.'
                : 'They start appearing in lineups, attendance, dues and team emails again.'}
            </p>
          </div>
          <button
            type="button"
            className={`btn btn-ghost ${player.status === 'active' ? styles.playerDangerBtn : ''}`}
            disabled={togglingStatus}
            onClick={handleToggleStatus}
          >
            {togglingStatus ? '…' : player.status === 'active' ? 'Take off the roster' : 'Add back'}
          </button>
        </div>
      )}
      </>)}

      {/* ── FAMILY & PAPERWORK: who to call, and what is on file ─────────────────────────── */}
      {tab === 'family' && (<>
      {/* ── Relocated from the rail, 2026-08-13 ─────────────────────────────────────────────
          Owner ruling: TWO sections, not one combined card and not folded into Player. Safety is
          the reason — allergies and an emergency number are what someone opens this page for in a
          hurry, and burying them one level inside a larger card costs exactly the seconds that
          matter. Both sections write into the SAME form state and save through the SAME Save bar
          as everything else on this page; this was a move within one form, never a new save path.

          ⚠ DO NOT MERGE WITH THE "Guardians" SECTION BELOW. That card is the family members who
          can log in (Chunk D). It rides the roster-PII capability and renders nothing at all while
          the guardian tier is off. These fields are the contact details on the ROSTER RECORD and
          are not behind that gate — folding them together would hide editable contact fields from
          coaches who can legitimately edit them today. */}
      <CoachCollapseSection sectionId="guardian" title="Guardian contact">
        {/* Says what this is without pointing at the Guardians section, which may not render. */}
        <p className={styles.detailPlaceholder} style={{ marginTop: 0, marginBottom: '0.9rem' }}>
          The contact on this player&apos;s roster record — where dues reminders and team emails go.
        </p>
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
      </CoachCollapseSection>

      <CoachCollapseSection sectionId="safety" title="Safety" defaultOpen={false}>
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label} htmlFor="medical">Allergies / medical notes</label>
            <textarea id="medical" className={styles.textarea} rows={3}
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
      </CoachCollapseSection>

      {/* Documents — a player's signed waiver / medical consent needs BOTH `documents` and
          guardian-PII clearance. Rendering it unconditionally put that child's medical PDF one tap
          away directly beneath the guardian fields this same page had just blanked out. The routes
          are the real gate (they 403 either way); this keeps the surface from advertising a file
          the coach cannot open. */}
      {/* This player's guardians (Chunk D Slice 2). Rides `rosterPii` — the same capability
          that governs guardian contact details, since this card shows exactly those. Renders
          nothing at all while the guardian tier is switched off. */}
      {/* ⚠ NO COLLAPSE WRAPPER HERE — the card draws its own, so that when the guardian tier is
          switched off (which it is, pending privacy counsel review) the whole section disappears
          instead of leaving an empty drawer between Safety and Documents. See the card's docblock. */}
      {assignment && assignment.capabilities.rosterPii && player && (
        <PlayerGuardiansCard
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
          playerFirstName={player.playerFirstName}
          rosterGuardianEmail={player.guardianEmail ?? null}
        />
      )}

      {assignment && canViewPlayerDocuments(assignment.capabilities) && (
        <CoachCollapseSection sectionId="documents" title="Documents" defaultOpen={false}>
          <PlayerDocumentsSection
            orgSlug={orgSlug}
            teamId={teamId}
            playerId={playerId}
            canManage={canManagePlayerDocuments(assignment.capabilities)}
          />
        </CoachCollapseSection>
      )}

      </>)}

      {/* ── THIS SEASON: how the player is actually doing ────────────────────────────────── */}
      {tab === 'season' && (<>
      {/* Development (Player Development 3A) — section renders only when this coach can see
          goals (notes) or measurables (record access); the API filters server-side regardless. */}
      {assignment && (canViewDevelopmentGoals(assignment.capabilities) || canViewMeasurables(assignment.capabilities)) && (
        <CoachCollapseSection sectionId="development" title="Development">
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
            seasonName={stripTeamNamePrefix(assignment.programYearName, assignment.teamName) || null}
          />
        </CoachCollapseSection>
      )}

      {/* The family season recap, previewed (Chunk D 3.2). Live season only — the route
          resolves the ACTIVE year and cannot address an archived one (the archive is opt-in),
          and `isReadOnly` keeps the door off an archived page rather than letting it 404.
          Gated on `notes` alone, matching the payload's development content and the route's own
          gate (A1, 2026-08-03 — the roster half became redundant once names went baseline).
          Left unwrapped by CoachCollapseSection — the component already implements its own
          collapsed-by-default, fetch-on-open preview (a deliberate product decision, see the
          component's own docblock); nesting it in a second disclosure would stack two
          independent expand controls on one card. */}
      {/* Game-Day P2 — moments this player was tagged in (owner Q3, 2026-08-05). Deliberately
          sits BESIDE the recap preview rather than inside it: the family recap writes itself
          from records, and these are the coach's own lines — material to read before the
          season-end conversation, never text forwarded to a parent. Absent when there are
          none, and absent in an archived season (the route sends nothing). */}
      {moments.moments.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.sectionHeadRow}>
            <p className={styles.detailSectionTitle}>Moments you logged</p>
            {moments.total > moments.moments.length && (
              <span className={styles.detailPlaceholder}>{moments.total} this season</span>
            )}
          </div>
          {moments.moments.map(m => (
            <div key={m.id} className={styles.gdMomentRow}>
              <span className={styles.gdMomentTime}>
                {formatInOrgZone(m.happenedAt, { month: 'short', day: 'numeric' })}
              </span>
              <span className={styles.gdMomentBody}>{m.body}</span>
            </div>
          ))}
          <p className={styles.detailPlaceholder}>
            From games you ran the bench for. Yours and your staff’s — families don’t see these.
          </p>
        </div>
      )}

      {assignment && player
        && canViewDevelopmentGoals(assignment.capabilities) && (
        <PlayerRecapPreview
          key={playerId}
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
          playerFirstName={clean(player.playerFirstName)}
        />
      )}

      {/* Attendance */}
      <CoachCollapseSection sectionId="attendance" title="Attendance" defaultOpen={false}>
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
      </CoachCollapseSection>

      {/* Awards */}
      <CoachCollapseSection sectionId="awards" title="Awards" defaultOpen={false}>
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
      </CoachCollapseSection>

      {/* Dues — relocated from the rail, 2026-08-13. The one group here that was already read-only,
          so it lands at the foot of the page with Attendance and Awards: all three answer "how is
          this player tracking?", and none of them is what you opened the profile to edit.
          "Manage dues →" stays the door to the surface that actually owns the editing. */}
      <CoachCollapseSection
        sectionId="dues"
        title="Dues"
        defaultOpen={false}
        meta={dues && dues.hasSchedule ? money(dues.balance) : undefined}
      >
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
        <Link href={moneySectionHref(base, 'dues', undefined)} className={styles.contactLink}>Manage dues →</Link>
      </CoachCollapseSection>
      </>)}

      {/* ⚠ THE SAVE BAR IS OUTSIDE THE TABS ON PURPOSE. The form lives on Details, but the state
          lives on this component — so a coach who edits a field and switches tabs still has unsaved
          work, and a bar that vanished with the tab would be a page quietly holding changes it had
          stopped mentioning. It stays pinned wherever they are. */}
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
