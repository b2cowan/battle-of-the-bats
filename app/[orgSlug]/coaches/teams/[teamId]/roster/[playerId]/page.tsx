'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseDevelopmentAddress, returnLabel } from '@/lib/development-address';
import { Users, AlertTriangle, Check } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { stripTeamNamePrefix } from '@/lib/coach-season-label';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachPageSection from '@/components/coaches/CoachPageSection';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import FeedbackModal from '@/components/FeedbackModal';
import PlayerDocumentsSection from '@/components/coaches/PlayerDocumentsSection';
import PlayerGuardiansCard from '@/components/coaches/PlayerGuardiansCard';
import PlayerDevelopmentSection from '@/components/coaches/PlayerDevelopmentSection';
import PlayerRecapPreview from '@/components/coaches/PlayerRecapPreview';
import PlayerNotesTab from '@/components/coaches/PlayerNotesTab';
import { canViewDevelopmentGoals, canViewMeasurables, canViewPlayerDocuments, canManagePlayerDocuments } from '@/lib/coach-capabilities';
import PositionProfileEditor, { type PositionProfileValue } from '@/components/coaches/PositionProfileEditor';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { playerPositionPrefs, pitcherSummary } from '@/lib/lineup-profile';
import { cleanNamePart, playerName, telHref } from '@/lib/coach-roster-name';
import { formatShortDate, formatShortInstant } from '@/lib/measurable-format';
import {
  BATS_OPTIONS, THROWS_OPTIONS, JERSEY_SIZE_OPTIONS,
  BATS_LABELS, THROWS_LABELS, JERSEY_SIZE_LABELS,
} from '@/lib/rep-roster-options';
import { moneySectionHref } from '@/lib/coach-money-links';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import { formatMoney } from '@/lib/coach-register';
import { PLAYER_TABS, DEFAULT_PLAYER_TAB, playerTabHref, resolvePlayerTab, type PlayerTab } from '@/lib/coach-player-tabs';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import type { RepRosterPlayer } from '@/lib/types';
import type { CoachCapabilities } from '@/lib/coach-capabilities';
import type { RepPlayerAttendanceSummary, RepPlayerDuesSummary, RepPlayerAwardsSummary } from '@/lib/db';
import type { FairPlayRow } from '@/lib/lineup-season-analytics';

const ATTN_CHIP: Record<string, string> = {
  attending: styles.badgeActive,
  late:      styles.badgeCompleted,
  absent:    styles.badgeOverdue,
  unknown:   styles.badgeDraft,
};
const ATTN_LABEL: Record<string, string> = {
  attending: 'Present', late: 'Late', absent: 'Absent', unknown: '—',
};

/** A stored option's label, or the raw value when the option list has moved on; '' when unset. */
const optLabel = (labels: Record<string, string>, v: string | null | undefined) => (v ? labels[v] ?? v : '');

/* ⚠ FIVE TABS, WITH AN ADDRESS (owner rulings 2026-09-13 — roster + player page review, hub
   R2-1..3, F09, F13, F19, F20). The August rework (three `useState` tabs, folds inside each) got the
   shape right and left the seams: a tab is already a grouping, and a fold inside one hid the thing
   the tab was opened for; Details was ONE accordion with nothing to fold against; Development was
   outgrowing a card on a summary tab; the tabs had no URL, so a reload lost the tab and a link from
   the roster could not name one.
   Now: Details (the record — lands first) · This season (the facts: attendance, playing time,
   awards, dues) · Skills & Goals (the judgement, named for the sidebar item) · Notes (everything
   written about the player, read in one place) · Family & paperwork (who to call). Each tab is a
   flat page of sections; `?tab=` names the tab on the portal's shared tab bar; `?section=` still
   scrolls-and-flashes within it; the glance card is the index on every tab, which is what lets
   Details land first without losing the mid-season answer. The tab table itself lives in
   `lib/coach-player-tabs.ts` so the roster's prompts and a unit test read the same one. */

/** Which tabs need a capability: Skills & Goals needs goals or measurables; Notes needs Internal
 *  notes. A tab not listed here is every coach's. */
const TAB_GATE: Partial<Record<PlayerTab, (caps: CoachCapabilities) => boolean>> = {
  skills: caps => canViewDevelopmentGoals(caps) || canViewMeasurables(caps),
  notes:  caps => canViewDevelopmentGoals(caps),
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

/** This player's row of the season's playing-time roll-up, plus the season's lineup count. */
interface PlayingTime {
  fieldInnings: number; benchInnings: number; games: number; gamesWithLineup: number;
}


function playerToForm(p: RepRosterPlayer, pitcherPos: string | null): EditForm {
  return {
    playerFirstName:   cleanNamePart(p.playerFirstName),
    playerLastName:    cleanNamePart(p.playerLastName),
    playerDateOfBirth: p.playerDateOfBirth ?? '',
    playerNumber:      cleanNamePart(p.playerNumber),
    positions:         (() => { const prefs = playerPositionPrefs(p, pitcherPos); return { best: prefs.preferred, never: prefs.never }; })(),
    pitcher:           (() => { const pit = p.lineupProfile?.pitcher; return { isPitcher: !!pit, rank: pit?.rank ?? 1, maxInnings: pit?.maxInnings != null ? String(pit.maxInnings) : '' }; })(),
    aSquad:            p.lineupProfile?.aSquad ?? false,
    guardianFirstName: cleanNamePart(p.guardianFirstName),
    guardianLastName:  cleanNamePart(p.guardianLastName),
    guardianEmail:     cleanNamePart(p.guardianEmail),
    guardianPhone:     cleanNamePart(p.guardianPhone),
    notes:             cleanNamePart(p.notes),
    medicalNotes:          cleanNamePart(p.medicalNotes),
    emergencyContactName:  cleanNamePart(p.emergencyContactName),
    emergencyContactPhone: cleanNamePart(p.emergencyContactPhone),
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

/** One label / value row of the read-only record (hub F16). */
function RecordRow({ label, value, kept }: { label: string; value: string | null | undefined; kept?: boolean }) {
  const v = (value ?? '').trim();
  const shown = kept ? 'Kept to the head coach' : v || '—';
  return (
    <>
      <dt>{label}</dt>
      <dd data-empty={shown === v ? undefined : ''}>{shown}</dd>
    </>
  );
}

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string; playerId: string }>;
}) {
  const { orgSlug, teamId, playerId } = use(params);
  const router = useRouter();
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
  const confirm = useConfirm();
  const [attendance, setAttendance] = useState<RepPlayerAttendanceSummary | null>(null);
  const [dues, setDues] = useState<RepPlayerDuesSummary | null>(null);
  const [awards, setAwards] = useState<RepPlayerAwardsSummary | null>(null);
  const [playingTime, setPlayingTime] = useState<PlayingTime | null>(null);
  /** The roster, for the Switch player dropdown — the coach's own order, active players only. */
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
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
      setRoster(data.roster ?? []);
    } catch (e: unknown) {
      showFeedback('danger', errorMessage(e, 'Failed to load.'));
    } finally {
      setFetching(false);
    }
  }, [orgSlug, teamId, playerId, pitcherPos]);

  useEffect(() => { if (!assignmentsLoading) void Promise.resolve().then(load); }, [assignmentsLoading, load]);

  const searchParams = useSearchParams();
  const caps = assignment?.capabilities ?? null;
  const tab: PlayerTab = (() => {
    const requested = resolvePlayerTab(searchParams);
    const gate = TAB_GATE[requested];
    return !gate || (caps && gate(caps)) ? requested : DEFAULT_PLAYER_TAB;
  })();

  /* Playing time (hub Q9) is a whole-season lineup roll-up the landing tab never shows, so it is
     asked for only when This season is open — from the `lineup-analytics` route the Overview and
     the Insights report already read (one composition, `lib/team-season-analytics`), gated on
     lineups like both of them. Fail-quiet: without it the tab simply has no Playing time section. */
  useEffect(() => {
    if (assignmentsLoading || tab !== 'season' || !caps?.lineups) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled || !json?.analytics) return;
        const row = (json.analytics.fairPlay as FairPlayRow[]).find(r => r.playerId === playerId);
        setPlayingTime({
          fieldInnings: row?.fieldInnings ?? 0, benchInnings: row?.benchInnings ?? 0, games: row?.games ?? 0,
          gamesWithLineup: json.analytics.gamesWithLineup ?? 0,
        });
      })
      .catch(() => { /* no section */ });
    return () => { cancelled = true; };
  }, [assignmentsLoading, tab, caps?.lineups, orgSlug, teamId, playerId]);

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
            // Best/Never picker + Pitching section: the server derives primary/secondary + the
            // stored profile. A-squad (P4) is carried through untouched until that phase ships.
            lineupProfile: {
              preferred: form.positions.best,
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
      const firstName = cleanNamePart(player.playerFirstName) || 'this player';
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
  const playerBase = `${base}/roster/${playerId}`;
  /**
   * The way back names where the coach CAME FROM when a development link brought them here
   * (Phase 1, F09: the Players tab or the Insights report, carrying its own filters) — a back
   * arrow fixed to Roster would move a coach to a page they were never on (the 2026-08-26 rule:
   * a back arrow names where it returns to, and returns there). Only a path inside this team's
   * portal survives the parse; anything else falls back to Roster.
   */
  // Parsed ONCE, here, because this page survives a tab switch and the Development section does
  // not: the section flashes the addressed row on arrival and then tells the page it has — a
  // remount (Skills → Family → Skills) must not re-run the arrival on the same address.
  const [arrival, setArrival] = useState(() => parseDevelopmentAddress(searchParams, base));
  const returnTo = arrival.returnTo;
  const backTo = returnTo && returnLabel(returnTo, base)
    ? { href: returnTo, label: returnLabel(returnTo, base)! }
    : { href: `${base}/roster`, label: 'Roster' };

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
  const attnPct = attnKnown > 0 ? `${attnRate}%` : '—';
  const age = ageFromDob(player.playerDateOfBirth);
  const bestPositions = form.positions.best;
  const canWriteRoster = !!page.capabilities?.rosterWrite;
  const pii = !!caps?.rosterPii;
  const firstName = cleanNamePart(player.playerFirstName);
  const firstOrThis = firstName || 'this player';
  const fullName = playerName(player);
  const guardianName = [player.guardianFirstName, player.guardianLastName].filter(Boolean).join(' ').trim();

  // Which tabs THIS coach has (the same gate that decided `tab` above).
  const tabs = PLAYER_TABS.filter(t => { const gate = TAB_GATE[t.id]; return !gate || (!!caps && gate(caps)); });
  const tabHref = (id: PlayerTab, section?: string) => playerTabHref(playerBase, id, { section, returnTo });

  // Money words, once (hub F12): a negative balance is a CREDIT the team holds for the family, and
  // the balance is said the same way everywhere on the page.
  const credit = dues?.hasSchedule && dues.balance < 0 ? -dues.balance : 0;
  const balanceLabel = dues?.hasSchedule ? (credit > 0 ? `${formatMoney(credit)} credit` : formatMoney(dues.balance)) : '';

  /* The Switch player dropdown (hub F14, owner R2-5). A native select — the sidebar's team switcher
     is one too — listing the roster in the coach's own order with the current player selected;
     picking one opens that player on the SAME tab (the tab rides in the address). A player who is
     off the roster is not in the list, so the select starts on a blank prompt for them. */
  const onList = roster.some(r => r.id === playerId);
  /* ⚠ A SELECT IS NOT A LINK, so the unsaved-changes guard (which intercepts anchor clicks and the
     browser's own leave) never sees this navigation — a dirty form would have been dropped without
     a word (/review, 2026-09-13). The same question the guard asks, asked here. */
  async function switchTo(id: string) {
    if (!id || id === playerId) return;
    if (isDirty) {
      const ok = await confirm({
        title: 'Leave without saving?',
        message: 'You have unsaved changes on this player. Switching players discards them.',
        confirmText: 'Discard and switch', cancelText: 'Stay', tone: 'danger',
      });
      if (!ok) return;
    }
    router.push(playerTabHref(`${base}/roster/${id}`, tab, { returnTo }));
  }
  const switchPlayer = roster.length > 1 ? (
    <select
      className={styles.playerSwitch}
      aria-label="Switch player"
      value={onList ? playerId : ''}
      onChange={e => { void switchTo(e.target.value); }}
    >
      {!onList && <option value="">Switch player…</option>}
      {roster.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
    </select>
  ) : null;

  return (
    <div className={styles.page}>
      <UnsavedChangesGuard active={isDirty} />
      {/* Header (page-header ruling 2026-08-11): the player's name, nothing under the title —
          jersey number and age are live facts, so they lead the glance card one line down.
          The way back is the ARROW in this header's leading corner (amendment 2026-08-26); the
          trailing slot holds the Switch player dropdown (2026-09-13). */}
      <CoachPageHeader
        icon={Users}
        title={fullName}
        backTo={backTo}
        actions={switchPlayer}
      />

      {/* ⚠ THE PLAYER, BEFORE THE FORM (owner ruling 2026-08-26), and THE INDEX ON EVERY TAB
          (hub F10, 2026-09-13). The chips are facts; the four tiles are DOORS — each opens the
          section it names, which is what lets Details be the landing tab without losing the
          mid-season answer. The one warning chip opens Safety (F15).
          ⚠ Off the roster is the ONE state worth stating, so it is the only badge here. */}
      <div className={styles.playerGlance}>
        <div className={styles.playerGlanceChips}>
          {player.status !== 'active' && (
            <span className={`${styles.badge} ${styles.badgeDraft}`}>Off the roster</span>
          )}
          {player.playerNumber && <span className={styles.playerGlanceJersey}>#{cleanNamePart(player.playerNumber)}</span>}
          {/* The pitching chip reads the way the editor names it — "Ace", "P2" (hub F05) — with
              the innings cap when one is set: the whole stored profile, in the form's words. */}
          {player.lineupProfile?.pitcher && (
            <span className={styles.chipQuiet}>{pitcherSummary(player.lineupProfile.pitcher)}</span>
          )}
          {bestPositions.length > 0 && <span className={styles.chipQuiet}>{bestPositions.join(' / ')}</span>}
          {player.lineupProfile?.aSquad && <span className={styles.chipQuiet}>A-squad</span>}
          {age !== null && <span className={styles.chipQuiet}>Age {age}</span>}
          {player.medicalNotes && (
            <Link href={tabHref('family', 'safety')} className={`${styles.chipDanger} ${styles.chipDoor}`} title="Medical notes on file — open Safety">
              <AlertTriangle size={11} aria-hidden /> Medical notes
            </Link>
          )}
        </div>

        {/* ⚠ FOUR TILES, ALL FROM DATA THIS PAGE HAS ALREADY FETCHED — no extra call for a summary.
            The Dues tile is money and rides the money gate with its section (the route sends null
            to a coach without it) — a tile reading "None set" to a coach who cannot see dues would
            be a lie about the family.
            ⚠ There is deliberately no "documents outstanding" tile: nothing in the product records
            which documents a team REQUIRES, and a tile that invented that number would be inventing
            a policy. Documents live on the Family & paperwork tab, where they can be counted
            honestly. */}
        <div className={styles.playerGlanceTiles}>
          {dues !== null && (
          <Link href={tabHref('season', 'dues')} className={`${styles.playerTile} ${styles.playerTileDoor}`} aria-label="Dues — open the Dues section">
            <span className={styles.playerTileKey}>Dues</span>
            <span className={styles.playerTileValue}
              data-tone={dues.hasSchedule && dues.balance > 0 ? 'danger' : undefined}>
              {!dues.hasSchedule ? 'None set' : dues.balance > 0 ? formatMoney(dues.balance) : 'Paid'}
            </span>
            <span className={styles.playerTileFoot}>
              {!dues.hasSchedule
                ? 'No dues this season'
                : credit > 0
                  ? `${formatMoney(credit)} credit held`
                  : `${dues.paidInstallmentCount}/${dues.installmentCount} installments paid`}
            </span>
          </Link>
          )}
          <Link href={tabHref('season', 'attendance')} className={`${styles.playerTile} ${styles.playerTileDoor}`} aria-label="Attendance — open the Attendance section">
            <span className={styles.playerTileKey}>Attendance</span>
            <span className={styles.playerTileValue}>{attnPct}</span>
            <span className={styles.playerTileFoot}>
              {attendance && attendance.total > 0
                ? `${attendance.total} recorded${attendance.unknown > 0 ? ` · ${attendance.unknown} not recorded` : ''}`
                : 'Nothing recorded yet'}
            </span>
          </Link>
          <Link href={tabHref('family', 'guardian')} className={`${styles.playerTile} ${styles.playerTileDoor}`} aria-label="Family — open Guardian contact">
            <span className={styles.playerTileKey}>Family</span>
            <span className={styles.playerTileValue}>{guardianName || 'No contact'}</span>
            <span className={styles.playerTileFoot}>
              {player.guardianEmail || player.guardianPhone || (pii ? 'Add a contact' : 'Kept to the head coach')}
            </span>
          </Link>
          <Link href={tabHref('season', 'awards')} className={`${styles.playerTile} ${styles.playerTileDoor}`} aria-label="Awards — open the Awards section">
            <span className={styles.playerTileKey}>Awards</span>
            <span className={styles.playerTileValue}>{awards?.total ?? 0}</span>
            <span className={styles.playerTileFoot}>this season</span>
          </Link>
        </div>
      </div>

      <CoachTabBar
        tabs={tabs.map(t => ({ id: t.id, label: t.label, short: t.short, href: tabHref(t.id) }))}
        activeId={tab}
        ariaLabel="Player record"
      />

      {/* ── DETAILS: the record. The form for the head coach; a record for everyone else (F16) ── */}
      {tab === 'details' && (<>
      <CoachPageSection sectionId="player" title="Player">
        {canWriteRoster ? (
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
          {/* ⚰ "Notes (private)" left this form on 2026-09-13 (hub Q8): it is the pinned About note at
              the top of the Notes tab — same field, same limit, same Save bar. */}
          <p className={`${styles.detailPlaceholder} ${styles.formGridFull}`} style={{ margin: 0 }}>
            Private notes about {firstOrThis} live on the <Link href={tabHref('notes', 'about')} className={styles.contactLink}>Notes</Link> tab.
          </p>
        </div>
        ) : (
        <>
          {/* ⚠ A RECORD, NOT A FORM THAT REFUSES TO SAVE (hub F16). A coach without roster-write used
              to see the same inputs as the head coach, type, get a Save bar, and be refused by the
              server — with redacted contact fields rendering as blank boxes that read as "nobody
              filled this in". Label / value rows; "—" for empty; one line for what is kept back. */}
          <dl className={styles.recordList}>
            <RecordRow label="Name" value={fullName} />
            <RecordRow label="Jersey #" value={cleanNamePart(player.playerNumber)} />
            <RecordRow label="Date of birth" value={player.playerDateOfBirth} kept={!pii} />
            <RecordRow label="Positions" value={bestPositions.length ? `Best: ${bestPositions.join(', ')}` : ''} />
            {pitcherPos && <RecordRow label="Pitching" value={player.lineupProfile?.pitcher ? pitcherSummary(player.lineupProfile.pitcher, 'innings cap') : 'Does not pitch'} />}
            <RecordRow label="A-squad" value={player.lineupProfile?.aSquad ? '★ Yes' : 'No'} />
            <RecordRow label="Bats / throws" value={[optLabel(BATS_LABELS, player.bats), optLabel(THROWS_LABELS, player.throws)].filter(Boolean).join(' / ')} />
            <RecordRow label="Jersey size" value={optLabel(JERSEY_SIZE_LABELS, player.jerseySize)} />
          </dl>
          <p className={styles.detailPlaceholder} style={{ marginBottom: 0 }}>Only the head coach can edit a player’s record.</p>
        </>
        )}
      </CoachPageSection>

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
                ? `Take ${firstOrThis} off the roster`
                : `Put ${firstOrThis} back on the roster`}
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

      {/* ── THIS SEASON: the record tab — what happened, in figures ───────────────────────── */}
      {tab === 'season' && (<>
      <CoachPageSection sectionId="attendance" title="Attendance"
        meta={attendance && attendance.total > 0 ? `${attnKnown > 0 ? `${attnRate}% · ` : ''}${attendance.total} recorded` : undefined}>
        {!attendance || attendance.total === 0 ? (
          <p className={styles.detailPlaceholder} style={{ margin: 0 }}>No attendance recorded yet this season.</p>
        ) : (
          <>
            <div className={styles.statBoxRow}>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{attnPct}</span><span className={styles.statBoxLabel}>Attendance</span></div>
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
                      <span className={styles.miniRowMeta}>{formatShortInstant(r.startsAt)}</span>
                      <span className={`${styles.badge} ${ATTN_CHIP[r.status] ?? styles.badgeDraft}`}>{ATTN_LABEL[r.status] ?? r.status}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {/* Sessions marked "unknown" were invisible — the denominator says so now (F18). */}
            {attendance.unknown > 0 && (
              <p className={styles.detailPlaceholder} style={{ marginBottom: 0 }}>
                {attendance.unknown} session{attendance.unknown === 1 ? '' : 's'} not recorded — not counted in the rate.
              </p>
            )}
          </>
        )}
      </CoachPageSection>

      {/* Playing time (hub Q9): field and bench innings from the season's saved lineups — a season
          FACT, so it lives here rather than in the judgement tab. Fetched when this tab opens (see
          the effect above); lineups-gated like the Overview tile and the Insights report, absent
          when the coach cannot read lineups. Vocabulary follows the playing-time ruling: innings
          and shares, never "fair". */}
      {playingTime && (
        <CoachPageSection sectionId="playing-time" title="Playing time"
          meta={`${playingTime.fieldInnings} field · ${playingTime.benchInnings} bench`}>
          {playingTime.fieldInnings + playingTime.benchInnings === 0 ? (
            <p className={styles.detailPlaceholder} style={{ margin: 0 }}>No saved lineups yet this season.</p>
          ) : (
            <div className={styles.statBoxRow}>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{playingTime.fieldInnings}</span><span className={styles.statBoxLabel}>Field innings</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{playingTime.benchInnings}</span><span className={styles.statBoxLabel}>Bench innings</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{Math.round((playingTime.fieldInnings / (playingTime.fieldInnings + playingTime.benchInnings)) * 100)}%</span><span className={styles.statBoxLabel}>On the field</span></div>
              <div className={styles.statBox}><span className={styles.statBoxValue}>{playingTime.games}</span><span className={styles.statBoxLabel}>Games</span></div>
            </div>
          )}
          <p className={styles.sectionFoot}>
            From the games with a saved lineup ({playingTime.gamesWithLineup} this season) · <Link href={insightsSectionHref(base, 'playing-time')} className={styles.contactLink}>Playing time report →</Link>
          </p>
        </CoachPageSection>
      )}

      {/* Awards (owner R2-6): award + count, the shape of the other summaries, and one door to the
          log of when each was given. The dates live in Insights; this page does not carry them. */}
      <CoachPageSection sectionId="awards" title="Awards"
        meta={awards && awards.total > 0 ? `${awards.total} this season` : undefined}>
        {!awards || awards.total === 0 ? (
          <p className={styles.detailPlaceholder} style={{ margin: 0 }}>No awards yet this season.</p>
        ) : (
          <>
            <ul className={styles.miniList}>
              {awards.byType.map(t => (
                <li key={t.awardTypeId} className={styles.miniRow}>
                  <span className={styles.miniRowMain}>{t.emoji ? `${t.emoji} ` : ''}{t.name}</span>
                  <span className={styles.miniRowMeta}>×{t.count}</span>
                </li>
              ))}
            </ul>
            <p className={styles.sectionFoot}>
              <Link href={insightsSectionHref(base, 'awards')} className={styles.contactLink}>When each was given →</Link>
            </p>
          </>
        )}
      </CoachPageSection>

      {/* Dues — the one group here that was already read-only. It lands at the foot with Attendance
          and Awards: all of them answer "how is this player tracking?", and none is what you opened
          the profile to edit. "Manage dues →" stays the door to the surface that owns the editing,
          and renders only when there is a schedule to manage (hub F12). */}
      {dues !== null && (
      <CoachPageSection sectionId="dues" title="Dues" meta={balanceLabel || undefined}>
        {!dues.hasSchedule ? (
          <p className={styles.detailPlaceholder} style={{ margin: 0 }}>No dues set for this player this season.</p>
        ) : (
          <>
            <div className={styles.statBoxRow}>
              <div className={styles.statBox}>
                <span className={styles.statBoxValue}>{formatMoney(dues.ladder.dues)}</span>
                <span className={styles.statBoxLabel}>Dues</span>
                {dues.totalAssessed - dues.ladder.dues > 0.005 && (
                  <span className={styles.detailPlaceholder}>
                    {formatMoney(dues.totalAssessed)} originally charged, after {formatMoney(dues.totalAssessed - dues.ladder.dues)} in adjustments &amp; forgiveness
                  </span>
                )}
              </div>
              {/* ⚠⚠ THE LADDER'S FIGURES, IN THE LADDER'S ORDER, SO THIS PAGE AND THE DUES TABLE
                  CANNOT DISAGREE (dues ladder, 2026-09-07). THE ORDER IS THE ARITHMETIC: Dues −
                  Fundraising − Other credits − Paid + Handed back = Balance, read left to right.
                  The zero rule is the drawer's: Fundraising, Other credits and Handed back are
                  EVENTS and hide when nothing happened; Dues, Paid and Balance always show. */}
              {dues.ladder.fundraising > 0 && (
                <div className={styles.statBox}><span className={styles.statBoxValue}>{formatMoney(dues.ladder.fundraising)}</span><span className={styles.statBoxLabel}>Fundraising</span></div>
              )}
              {dues.ladder.otherCredits > 0 && (
                <div className={styles.statBox}><span className={styles.statBoxValue}>{formatMoney(dues.ladder.otherCredits)}</span><span className={styles.statBoxLabel}>Other credits</span></div>
              )}
              <div className={styles.statBox}><span className={styles.statBoxValue}>{formatMoney(dues.ladder.paid)}</span><span className={styles.statBoxLabel}>Paid</span></div>
              {dues.ladder.handedBack > 0 && (
                <div className={styles.statBox}><span className={styles.statBoxValue}>{formatMoney(dues.ladder.handedBack)}</span><span className={styles.statBoxLabel}>Handed back</span></div>
              )}
              <div className={styles.statBox}>
                {/* One figure, one reading (F12): a negative balance is a credit, said as one. */}
                <span className={styles.statBoxValue} data-tone={dues.balance > 0 ? 'danger' : 'good'}>{balanceLabel}</span>
                <span className={styles.statBoxLabel}>Balance</span>
              </div>
            </div>
            <p className={styles.sectionFoot}>
              {dues.paidInstallmentCount}/{dues.installmentCount} installments paid
              {dues.overdue ? ' · overdue' : dues.nextDueDate ? ` · next due ${formatShortDate(dues.nextDueDate)}` : ''}
              {' · '}
              <Link href={moneySectionHref(base, 'dues', undefined)} className={styles.contactLink}>Manage dues →</Link>
            </p>
          </>
        )}
      </CoachPageSection>
      )}

      {/* The family season recap — one quiet row at the foot of the record tab (hub F11). Gated
          on `notes`, matching the payload's development content and the route's own gate. */}
      {caps && canViewDevelopmentGoals(caps) && (
        <PlayerRecapPreview
          key={playerId}
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
          playerFirstName={firstName}
        />
      )}
      </>)}

      {/* ── SKILLS & GOALS: the judgement tab. The Development section, wholesale, with the tab's
          full width (hub F19). Its own views (`?view=`), its own arrival, untouched. ── */}
      {tab === 'skills' && assignment && (
        <CoachPageSection sectionId="development">
          {/* key forces a fresh mount per player — no cross-player fetch races or stale drafts */}
          <PlayerDevelopmentSection
            key={playerId}
            orgSlug={orgSlug}
            teamId={teamId}
            playerId={playerId}
            playerName={fullName}
            playerNumber={player.playerNumber ? cleanNamePart(player.playerNumber) : null}
            teamName={assignment.teamName}
            seasonName={stripTeamNamePrefix(assignment.programYearName, assignment.teamName) || null}
            arrival={arrival}
            onArrived={() => setArrival(a => ({ ...a, view: null, metricId: null, goalId: null }))}
          />
        </CoachPageSection>
      )}

      {/* ── NOTES: everything written about the player, read in one place (hub F20) ── */}
      {tab === 'notes' && (
        <PlayerNotesTab
          key={playerId}
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
          playerFirstName={firstName}
          about={{
            value: form.notes,
            canEdit: canWriteRoster,
            onChange: v => setForm(f => f ? { ...f, notes: v } : f),
          }}
        />
      )}

      {/* ── FAMILY & PAPERWORK: who to call, and what is on file ─────────────────────────── */}
      {tab === 'family' && (<>
      {/* Owner ruling (2026-08-13): TWO sections, not one combined card and not folded into Player.
          Safety is the reason — allergies and an emergency number are what someone opens this page
          for in a hurry. Both write into the SAME form state and save through the SAME Save bar.
          ⚠ DO NOT MERGE WITH THE "Guardians" SECTION BELOW. That card is the family members who
          can log in (Chunk D). It rides the roster-PII capability and renders nothing at all while
          the guardian tier is off. These fields are the contact details on the ROSTER RECORD. */}
      <CoachPageSection sectionId="guardian" title="Guardian contact">
        <p className={styles.detailPlaceholder} style={{ marginTop: 0, marginBottom: '0.9rem' }}>
          The contact on this player&apos;s roster record — where dues reminders and team emails go.
        </p>
        {canWriteRoster ? (
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
              <a className={styles.contactLink} href={telHref(form.guardianPhone)}>Call or text</a>
            )}
          </div>
        </div>
        ) : (
        <>
          <dl className={styles.recordList}>
            <RecordRow label="Name" value={guardianName} kept={!pii} />
            <RecordRow label="Email" value={player.guardianEmail} kept={!pii} />
            <RecordRow label="Phone" value={player.guardianPhone} kept={!pii} />
          </dl>
          {pii && (player.guardianEmail || player.guardianPhone) && (
            <p className={styles.sectionFoot}>
              {player.guardianEmail && <a className={styles.contactLink} href={`mailto:${player.guardianEmail}`}>Email guardian</a>}
              {player.guardianEmail && player.guardianPhone && ' · '}
              {player.guardianPhone && <a className={styles.contactLink} href={telHref(player.guardianPhone)}>Call or text</a>}
            </p>
          )}
        </>
        )}
      </CoachPageSection>

      {/* Safety — open, not folded: this is where the ⚠ Medical notes chip lands (hub F15). */}
      <CoachPageSection sectionId="safety" title="Safety">
        {canWriteRoster ? (
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
              <a className={styles.contactLink} href={telHref(form.emergencyContactPhone)}>Call</a>
            )}
          </div>
        </div>
        ) : (
        <dl className={styles.recordList}>
          <RecordRow label="Allergies / medical" value={player.medicalNotes} kept={!pii} />
          <RecordRow label="Emergency contact" value={[player.emergencyContactName, player.emergencyContactPhone].filter(Boolean).join(' · ')} kept={!pii} />
        </dl>
        )}
      </CoachPageSection>

      {/* This player's guardians (Chunk D Slice 2). Rides `rosterPii`. Renders nothing at all while
          the guardian tier is switched off — the card draws its own disclosure for that reason. */}
      {caps && caps.rosterPii && (
        <PlayerGuardiansCard
          orgSlug={orgSlug}
          teamId={teamId}
          playerId={playerId}
          playerFirstName={player.playerFirstName}
          rosterGuardianEmail={player.guardianEmail ?? null}
        />
      )}

      {/* Documents — a player's signed waiver / medical consent needs BOTH `documents` and
          guardian-PII clearance. The routes are the real gate (they 403 either way); this keeps the
          surface from advertising a file the coach cannot open. */}
      {caps && canViewPlayerDocuments(caps) && (
        <CoachPageSection sectionId="documents" title="Documents">
          <PlayerDocumentsSection
            orgSlug={orgSlug}
            teamId={teamId}
            playerId={playerId}
            canManage={canManagePlayerDocuments(caps)}
          />
        </CoachPageSection>
      )}
      </>)}

      {/* ⚠ THE SAVE BAR IS OUTSIDE THE TABS ON PURPOSE. The form lives on Details, Family and the
          Notes tab's About note, but the state lives on this component — so a coach who edits a
          field and switches tabs still has unsaved work, and a bar that vanished with the tab would
          be a page quietly holding changes it had stopped mentioning. It stays pinned wherever they
          are. The spacer reserves scroll room so the bar never covers the last card. */}
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
