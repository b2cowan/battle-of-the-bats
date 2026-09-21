'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ListOrdered, ArrowRight, CheckCircle2, Plus, Pencil, Trash2, Check, X, ClipboardCheck, HelpCircle,
} from 'lucide-react';
import type { LineupBadge } from '@/lib/lineup-analysis';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { CoachRowList, CoachRow } from '@/components/coaches/CoachRowList';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import type { SportPack } from '@/lib/sports';
import { formatInOrgZone, formatOrgDayMonth } from '@/lib/timezone';
import { lineupTemplateHref } from '@/lib/lineups-address';
import LineupsTabs from './_LineupsTabs';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent, RepTeamLineupTemplate, RepRosterPlayer, RepTeamLineupEntry } from '@/lib/types';

/**
 * The lineup-template library — the TEMPLATES TAB of the Lineups room (the hub brought level with
 * the Practice plans room, owner ask 2026-09-18). The pane moved here WHOLE from the hub page:
 * the same row list, the same rename / apply / delete controls, the same apply-to-game picker.
 *
 * ⚠ A VIEW, not a page: the hub (`lineups/page.tsx`) resolves the team, the season and the
 * lineups capability before this mounts. It renders its own page header because its header
 * ACTION ("New template") is its own — the page-level action ruling (2026-08-13) puts a pane's
 * create in the header, not in a bar above the list, which is where it sat with a hint line
 * nobody needed once a template existed.
 *
 * ⚠ The games and their readiness come DOWN from the hub, which has already fetched them for its
 * own list — the picker must not fetch the season a second time. Applying a template writes the
 * game's lineup and hands the game id back up (`onApplied`), so the hub's readiness map moves to
 * Draft without a reload, the same as before the split.
 *
 * ⚠ Leaving the tab unmounts this view, and with it an in-progress rename and the pane's notice —
 * which is the behaviour the old `switchTab` cleared by hand. A pane switch is a context switch.
 */

// Weekday + time in the ORG's zone — the picker's rows share the hub's clock (see the hub's note).
function formatWeekday(value: string) {
  return formatInOrgZone(value, { weekday: 'short' });
}
function formatTime(value: string) {
  return formatInOrgZone(value, { hour: 'numeric', minute: '2-digit' });
}
export function gameTitle(e: RepTeamEvent) {
  if (e.opponent) return `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}`;
  return e.name || 'Game';
}

export default function LineupTemplatesView({
  orgSlug,
  teamId,
  sportPack,
  canBuildLineups,
  games,
  lineupStatus,
  onApplied,
}: {
  orgSlug: string;
  teamId: string;
  sportPack: SportPack;
  /** Whether this coach may create, rename, delete or apply — absent controls, never disabled. */
  canBuildLineups: boolean;
  /** The season's games, from the hub's read — what the apply-to-game picker lists. */
  games: RepTeamEvent[];
  /** Per-game readiness, from the hub's read — the picker's "Has lineup" chip. */
  lineupStatus: Record<string, LineupBadge>;
  /** A template was applied to this game — the hub moves it to Draft. */
  onApplied: (gameId: string) => void;
}) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const confirm = useConfirm();
  const { openHelp } = useHelpDrawer();
  const helpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-lineups'],
    label: 'Lineups',
    fullGuideHref: `/${orgSlug}/coaches/help#premium-lineups`,
  };

  const [templates, setTemplates] = useState<RepTeamLineupTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  // The template whose "apply to a game" picker is open (null = closed).
  const [applyTemplate, setApplyTemplate] = useState<RepTeamLineupTemplate | null>(null);
  const [applyBusyGameId, setApplyBusyGameId] = useState<string | null>(null);
  // Nav-hide + body-scroll-lock while the apply-template picker is open.
  useOverlayOpen(!!applyTemplate);

  // Guarded against a stale response landing on the wrong TEAM — this view does not unmount when
  // only the team segment changes (the hub's own note explains the race).
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!isStale()) setTemplates(data.templates ?? []);
    } catch {
      if (!isStale()) setError('Templates couldn’t be loaded — refresh to try again.');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => load(() => cancelled));
    return () => { cancelled = true; };
  }, [load]);

  // ── Template actions ──
  function startRename(t: RepTeamLineupTemplate) {
    setRenamingId(t.id);
    setRenameValue(t.name);
    setNotice('');
  }
  async function saveRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not rename');
      }
      setTemplates(list => list.map(t => t.id === id ? { ...t, name } : t).sort((a, b) => a.name.localeCompare(b.name)));
      setRenamingId(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not rename the template');
    } finally {
      setRenameBusy(false);
    }
  }

  async function deleteTemplate(t: RepTeamLineupTemplate) {
    if (!(await confirm({
      title: 'Delete template?',
      message: `Delete the saved template “${t.name}”? This can't be undone.`,
      confirmText: 'Delete', cancelText: 'Keep', tone: 'warning',
    }))) return;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${t.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete');
      setTemplates(list => list.filter(x => x.id !== t.id));
      setNotice(`Deleted “${t.name}”.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not delete the template');
    }
  }

  // Apply the open template onto a chosen game. Loads the game's lineup to (a) know if one already
  // exists (overwrite-aware confirm) and (b) map the template onto the game's current roster. The
  // lineup and template are the only things written — attendance is untouched.
  async function applyToGame(game: RepTeamEvent) {
    const t = applyTemplate;
    if (!t) return;
    setApplyBusyGameId(game.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup`);
      if (!res.ok) throw new Error('Could not open that game');
      const data: {
        players?: RepRosterPlayer[];
        lineup?: { notes?: string | null; rulesOverride?: unknown } | null;
        entries?: RepTeamLineupEntry[];
      } = await res.json();
      const rosterIds = new Set((data.players ?? []).map(p => p.id));
      const hasLineup = (data.entries ?? []).some(en => Object.values(en.inningPositions ?? {}).some(Boolean));

      const ok = await confirm(hasLineup ? {
        title: 'Overwrite this lineup?',
        message: `${gameTitle(game)} already has a lineup. Replace it with “${t.name}”?`,
        confirmText: 'Overwrite', cancelText: 'Keep current', tone: 'warning',
      } : {
        title: 'Apply template?',
        message: `Apply “${t.name}” to ${gameTitle(game)}?`,
        confirmText: 'Apply', cancelText: 'Cancel',
      });
      if (!ok) { setApplyBusyGameId(null); return; }

      // Map the template onto the game's CURRENT roster — silently skip players no longer rostered.
      const mapped = t.entries
        .filter(e => rosterIds.has(e.playerId))
        .map(e => ({ playerId: e.playerId, battingOrder: e.battingOrder, starter: e.starter, inningPositions: e.inningPositions }));
      const skipped = t.entries.length - mapped.length;
      if (mapped.length === 0) {
        setNotice(`None of “${t.name}”'s players are on ${gameTitle(game)}'s roster — nothing applied.`);
        setApplyBusyGameId(null);
        setApplyTemplate(null);
        return;
      }
      const put = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${game.id}/lineup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineupMode: t.lineupMode,
          inningCount: t.inningCount,
          notes: data.lineup?.notes ?? '',
          rulesOverride: data.lineup?.rulesOverride ?? null,
          entries: mapped,
        }),
      });
      if (!put.ok) {
        const d = await put.json().catch(() => ({ error: put.statusText }));
        throw new Error(d.error ?? 'Could not apply the template');
      }
      // Before game time the server resets a written lineup to Draft (readiness is a deliberate coach
      // act); the hub decides from the same clock whether to move the game (D11d keeps Ready once
      // the game has started), matching what a reload would show.
      onApplied(game.id);
      setNotice(skipped > 0
        ? `Applied “${t.name}” to ${gameTitle(game)} — skipped ${skipped} player${skipped === 1 ? '' : 's'} no longer on the roster.`
        : `Applied “${t.name}” to ${gameTitle(game)}.`);
      setApplyTemplate(null);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not apply the template');
    } finally {
      setApplyBusyGameId(null);
    }
  }

  const newHref = lineupTemplateHref(base, 'new');

  return (
    <div className={styles.page}>
      <CoachPageHeader
        icon={ListOrdered}
        title="Lineups"
        actions={canBuildLineups ? (
          /* House rule 3: on a phone the words become the symbol, and the aria-label keeps them. */
          <Link href={newHref} className={`${styles.btnPrimary} ${styles.headerPrimaryBtn}`} aria-label="New template">
            <Plus size={15} aria-hidden />
            <span className={styles.headerBtnLabel}>New template</span>
          </Link>
        ) : undefined}
        /* One compact create keeps the title line's corner on a phone; a read-only assistant has
           no create, so the row drops. */
        actionsPhoneInTitleRow
        actionsPhoneHidden={!canBuildLineups}
        helpLabel="Lineups"
        help={helpRequest}
      />
      <LineupsTabs base={base} active="templates" />

      {notice && <p className={styles.lineupNotice} style={{ marginBottom: '1rem' }}>{notice}</p>}

      <section aria-label="Templates">
        {loading ? (
          <div className={styles.loadingState}>Loading templates…</div>
        ) : error ? (
          <p className={styles.errorText}>{error}</p>
        ) : templates.length === 0 ? (
          <CoachEmptyState
            compact
            icon={<ClipboardCheck size={20} aria-hidden />}
            headline="No templates yet"
            description="A template is a reusable “base” lineup with no game attached — your usual order, a rain-day rotation, the arrangement you run at tournaments."
            payoff="Apply one to any game in a tap and it maps onto that game’s current roster, quietly skipping anyone who has left the team — so you’re not rebuilding the same lineup every week."
            primaryAction={canBuildLineups ? { label: 'New template', icon: <Plus size={15} aria-hidden />, href: newHref } : undefined}
            secondaryAction={{ label: 'How templates work', icon: <HelpCircle size={15} aria-hidden />, onClick: () => openHelp(helpRequest) }}
          />
        ) : (
          /* The templates as a row list (standard §3.10, F-28): the same frame as the games list;
             the name is the link (§3.6 — a row that navigates has the name as the link), the three
             controls sit in the trail and clear the tap floor at ≤ 768. */
          <CoachRowList label="Templates">
            {templates.map(t => (
              renamingId === t.id ? (
                <CoachRow
                  key={t.id}
                  as="static"
                  title={
                    <span className={styles.lineupTplRename}>
                      <input
                        className={styles.input}
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                        maxLength={80}
                        autoFocus
                        aria-label="Template name"
                      />
                      <button type="button" className={styles.lineupTplIconBtn} aria-label="Save name" disabled={!renameValue.trim() || renameBusy} onClick={() => saveRename(t.id)}>
                        <Check size={16} />
                      </button>
                      <button type="button" className={styles.lineupTplIconBtn} aria-label="Cancel rename" onClick={() => setRenamingId(null)}>
                        <X size={16} />
                      </button>
                    </span>
                  }
                />
              ) : (
                <CoachRow
                  key={t.id}
                  as="static"
                  title={<Link href={lineupTemplateHref(base, t.id)} className={`${styles.lineupTplName} ${styles.rowTapLink}`}>{t.name}</Link>}
                  caption={`${t.lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats'} · ${t.inningCount} ${sportPack.periodLabelPlural.toLowerCase()} · ${t.entries.length} player${t.entries.length === 1 ? '' : 's'}`}
                  trail={
                    <div className={styles.lineupTplActions}>
                      <button type="button" className={styles.btnSecondary} disabled={games.length === 0} title={games.length === 0 ? 'Add a game first' : undefined} onClick={() => { setNotice(''); setApplyTemplate(t); }}>
                        Apply
                      </button>
                      <button type="button" className={styles.lineupTplIconBtn} aria-label={`Rename ${t.name}`} title="Rename" onClick={() => startRename(t)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className={styles.lineupTplIconBtn} aria-label={`Delete ${t.name}`} title="Delete" onClick={() => deleteTemplate(t)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  }
                />
              )
            ))}
          </CoachRowList>
        )}
      </section>

      {/* ── Apply-to-game picker ── */}
      {applyTemplate && (
        <div className={`${styles.modalOverlay} ${styles.sheetOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget && !applyBusyGameId) setApplyTemplate(null); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title={<>Apply &ldquo;{applyTemplate.name}&rdquo; to&hellip;</>} onClose={() => setApplyTemplate(null)} closeIconSize={18} closeAriaLabel="Close" />
            <p className={styles.bodyNote} style={{ margin: '0 0 0.75rem' }}>Pick a game. You&apos;ll confirm before anything is overwritten.</p>
            {/* A row that is a BUTTON (it applies the template), on the same recipe as the games
                list — `CoachRow as="button"` is the row-list component's own second face. Inset:
                the modal paints the ground. */}
            <CoachRowList inset label="Games">
              {games.map(g => (
                <CoachRow
                  key={g.id}
                  as="button"
                  disabled={!!applyBusyGameId}
                  onClick={() => applyToGame(g)}
                  lead={formatOrgDayMonth(g.startsAt)}
                  leadKind="date"
                  title={gameTitle(g)}
                  caption={`${formatWeekday(g.startsAt)} · ${formatTime(g.startsAt)}`}
                  trail={(lineupStatus[g.id] && lineupStatus[g.id] !== 'not_started') ? <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Has lineup</span> : undefined}
                  door={{ label: applyBusyGameId === g.id ? 'Applying…' : 'Apply', icon: <ArrowRight size={14} aria-hidden /> }}
                />
              ))}
            </CoachRowList>
          </div>
        </div>
      )}
    </div>
  );
}
