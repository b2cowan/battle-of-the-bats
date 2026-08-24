'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
  downloadPDF, fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import styles from '../../../../rep-teams.module.css';
import type { RepTeam, RepProgramYear, RepProgramYearStatus, RepRosterPlayer, RepRosterStatus } from '@/lib/types';

// ── Export definition ─────────────────────────────────────────────────────────

const ROSTER_EXPORT_COLS: ExportColumnDef[] = [
  { label: '#',             key: 'playerNumber',      format: 'text' },
  { label: 'First Name',    key: 'playerFirstName',   format: 'text' },
  { label: 'Last Name',     key: 'playerLastName',    format: 'text' },
  { label: 'Date of Birth', key: 'playerDateOfBirth', format: 'date', sensitive: true },
  { label: 'Status',        key: 'status',            format: 'text' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
/** How a ROSTER PLAYER's standing is named — on screen and on the PDF's group headings alike. */
const ROSTER_STATUS_LABEL: Record<RepRosterStatus, string> = {
  active: 'Active', inactive: 'Inactive', released: 'Released',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

const NEXT_STATUS: Record<RepProgramYearStatus, RepProgramYearStatus | null> = {
  draft: 'active', active: 'completed', completed: 'archived', archived: null,
};
const NEXT_LABEL: Record<RepProgramYearStatus, string> = {
  draft: 'Activate', active: 'Mark Completed', completed: 'Archive', archived: '',
};

interface Summary {
  rosterCount: number;
  pendingTryouts: number;
  coachCount: number;
  upcomingEvents: number;
}

export default function ProgramYearOverviewPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; yearId: string }>;
}) {
  const params = use(paramsPromise);
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [team, setTeam] = useState<RepTeam | null>(null);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fetching, setFetching] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  // Roster
  const [players, setPlayers] = useState<RepRosterPlayer[]>([]);
  const [rosterFetching, setRosterFetching] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger' | 'info'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  // Marking a season completed changes what every coach on the team can do — it gets an
  // explicit confirmation naming that impact (Coach Portal Batch 3, D2). Other transitions
  // (activate, archive) stay one-click.
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}${orgQuery}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setTeam(data.team);
      setProgramYear(data.programYear);
      setSummary(data.summary);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load program year.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, params.yearId, orgQuery]);

  /**
   * ⚠ Sequence-tokened for the same reason as the coaches' roster (Rosters pass, /review finding):
   * this page can now produce a DOWNLOADED document from `players`, so a slow response for a
   * previous program year landing late would not just flicker on screen — it would put the wrong
   * year's players inside a PDF titled for this one. Cheap insurance: navigating between two year
   * pages currently unmounts this component, but nothing guarantees that stays true.
   */
  const rosterSeq = useRef(0);
  const loadRoster = useCallback(async () => {
    const seq = ++rosterSeq.current;
    setRosterFetching(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}/roster${orgQuery}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (seq !== rosterSeq.current) return;
        setPlayers(data.players ?? []);
      }
    } finally {
      if (seq === rosterSeq.current) setRosterFetching(false);
    }
  }, [params.teamId, params.yearId, orgQuery]);

  useEffect(() => { if (currentOrg) { load(); loadRoster(); } }, [currentOrg, load, loadRoster]);

  useEffect(() => {
    // Server-resolved ADMIN paper (D4): the org-name header fallback plus the org's uploaded
    // logo, print-ready. A failed fetch leaves null and the roster prints on default paper.
    // Gated on the org like the loads above — without a slug the route fails closed, so an
    // ungated call is a guaranteed 401 whose late arrival could only clobber a good answer.
    if (!currentOrg) return;
    // Cleanup-guarded like the coaches' equivalent: a slow response for a previous org can never
    // land as this one's branding. (The tryouts sibling still has the unguarded copy of this
    // effect — same shape, pre-existing, noted rather than swept into this pass.)
    let cancelled = false;
    void fetchResolvedPdfSettings(
      `/api/admin/org/pdf-settings${orgQuery ? `${orgQuery}&resolve=1` : '?resolve=1'}`,
    ).then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [currentOrg, orgQuery]);

  async function handleTransition(newStatus: RepProgramYearStatus) {
    setTransitioning(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}${orgQuery}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setProgramYear(data.programYear);
      showFeedback('success', `Status updated to ${STATUS_LABEL[newStatus]}.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update status.');
    } finally {
      setTransitioning(false);
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function buildRosterExportRows(includeSensitive = false) {
    return serializeRows(
      players.map(p => ({
        playerNumber:      p.playerNumber ?? '',
        playerFirstName:   p.playerFirstName,
        playerLastName:    p.playerLastName,
        playerDateOfBirth: p.playerDateOfBirth ?? '',
        status:            p.status,
      })),
      ROSTER_EXPORT_COLS,
      includeSensitive,
    );
  }

  function handleExportXLSX() {
    const headers  = serializeHeaders(ROSTER_EXPORT_COLS);
    const data     = buildRosterExportRows(false);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'roster', scope: team?.name },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Roster');
  }

  function handleExportCSV() {
    const headers  = serializeHeaders(ROSTER_EXPORT_COLS);
    const data     = buildRosterExportRows(false);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'roster', scope: team?.name },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  /**
   * The program-year roster on paper (PDF Export Quality decision 2, built in the Phase 2
   * Rosters pass; this menu's PDF item used to open an info modal promising org branding no org
   * had ever printed).
   *
   * ADMIN paper — org name, org logo, club look — because this surface belongs to the club
   * admin, not a coach. Its team-side sibling (the coaches' roster) prints on team paper.
   *
   * ⚠ NOTHING PRIVATE PRINTS: no date of birth, no guardian name, email or phone, no notes.
   * Those stay in the spreadsheet exports, where the sensitive columns are already opt-in. Same
   * privacy floor the two new registers took in the Registers pass, and an owner ruling in this
   * one: a club that files with an association has the spreadsheet for it, and this document is
   * the wall-shaped reading.
   *
   * Grouped by where each player stands, with a count on every heading, and NO Status column —
   * the heading already is one.
   */
  async function handleExportPDF() {
    if (!players.length) return;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings ?? {}) };

    const headers = ['#', 'Player', 'Primary', 'Secondary'];
    const pdfRow = (p: RepRosterPlayer) => [
      p.playerNumber ?? '',
      [p.playerFirstName, p.playerLastName].filter(Boolean).join(' '),
      p.primaryPosition ?? '',
      p.secondaryPosition ?? '',
    ];

    /**
     * One section per standing, known ones first in the order the roster table reads them.
     *
     * ⚠ EVERY PLAYER LANDS IN EXACTLY ONE SECTION, and that is deliberate rather than incidental.
     * `status` is plain `text` in the database with an app-side union, and this repo has already
     * been bitten once by a status set quietly gaining a member (the sponsorship enum broke
     * nineteen readers invisibly). Filtering by a hardcoded list would drop such a player off a
     * roster a club submits to its association — the worst possible place to lose someone
     * silently. So unknown values get their own section under their raw name instead.
     */
    const known = ['active', 'inactive', 'released'] as const;
    const order = [
      ...known,
      ...[...new Set(players.map(p => p.status))].filter(s => !known.includes(s as never)),
    ];
    const groups = order
      .map(status => ({
        label: ROSTER_STATUS_LABEL[status as RepRosterStatus] ?? String(status),
        rows: players.filter(p => p.status === status).map(pdfRow),
      }))
      .filter(g => g.rows.length > 0)
      .map(g => ({ ...g, label: `${g.label} · ${g.rows.length}` }));

    await downloadPDF(
      buildFilename({ org: currentOrg?.slug, dataset: 'roster', scope: team?.name }, 'pdf'),
      'Program Year Roster',
      [team?.name, programYear?.name].filter(Boolean).join(' — ') || undefined,
      headers,
      [],
      settings,
      // Four columns: portrait at readable density, with room to spare.
      { groups, identity: currentOrg?.name ?? undefined, shape: { orientation: 'portrait' } },
    );
  }

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  if (!team || !programYear) {
    return <p className={styles.muted}>Program year not found.</p>;
  }

  const yearBase = `${base}/rep-teams/teams/${team.id}/program-years/${programYear.id}`;
  const nextStatus = NEXT_STATUS[programYear.status];

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${team.id}`}>{team.name}</Link>
        <span><ChevronRight size={12} /></span>
        <span>{programYear.name}</span>
      </div>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 className={styles.pageTitle}>{programYear.name}</h1>
              <HelpTooltip
                title="What is a program year?"
                body="A program year represents one competitive season for a team. Roster, schedule, finances, and tryouts are all scoped to a program year. Create a new one at the start of each season."
              />
              <span className={`${styles.badge} ${STATUS_CSS[programYear.status] ?? styles.badgeDraft}`}>
                {STATUS_LABEL[programYear.status] ?? programYear.status}
              </span>
              {programYear.tryoutOpen && (
                <span className={`${styles.badge} ${styles.badgeActive}`}>Tryouts Open</span>
              )}
            </div>
            <p className={styles.pageSub}>{team.name}</p>
          </div>
        </div>
      </div>

      {/* Lifecycle transition */}
      {canWrite && nextStatus && (
        <div className={styles.lifecycleRow}>
          <span className={styles.lifecycleLabel}>Status</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (nextStatus === 'completed' ? setConfirmCompleteOpen(true) : handleTransition(nextStatus))}
            disabled={transitioning}
          >
            {transitioning ? 'Updating…' : NEXT_LABEL[programYear.status]}
          </button>
        </div>
      )}

      {/* Completing a season is the one transition that changes COACH access — confirm it,
          and tell the truth about what happens (Batch 3, D2; approved mockups = spec). */}
      {confirmCompleteOpen && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) setConfirmCompleteOpen(false); }}>
          <div className={styles.modal} role="dialog" aria-modal="true" aria-label={`Mark ${programYear.name} completed`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Mark {programYear.name} completed?</h2>
            </div>
            <ul style={{ margin: '0 0 1.1rem', paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
              <li>The season locks as <strong style={{ color: 'var(--white-90)' }}>read-only</strong> — scores, roster, and money records are kept; nothing can be edited.</li>
              <li>Coaches keep access: they&apos;ll see a <strong style={{ color: 'var(--white-90)' }}>Season&apos;s End</strong> wrap-up and their season history — they are not locked out.</li>
              <li>The next season starts with an <strong style={{ color: 'var(--white-90)' }}>empty coach list</strong> — re-add your coaches when you create it.</li>
              <li>A completed season can be archived, but not reopened.</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmCompleteOpen(false)} disabled={transitioning}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => { setConfirmCompleteOpen(false); await handleTransition('completed'); }}
                disabled={transitioning}
              >
                Mark completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Roster</span>
          <span className={styles.summaryCardValue}>{summary?.rosterCount ?? 0}</span>
          <Link href={`${yearBase}/roster`} className={styles.summaryCardLink}>View roster →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Tryouts Pending</span>
          <span className={styles.summaryCardValue}>{summary?.pendingTryouts ?? 0}</span>
          <Link href={`${yearBase}/tryouts`} className={styles.summaryCardLink}>View tryouts →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Coaches</span>
          <span className={styles.summaryCardValue}>{summary?.coachCount ?? 0}</span>
          <Link href={`${yearBase}/coaches`} className={styles.summaryCardLink}>Manage coaches →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Upcoming Events</span>
          <span className={styles.summaryCardValue}>{summary?.upcomingEvents ?? 0}</span>
          <Link href={`${yearBase}/schedule`} className={styles.summaryCardLink}>View schedule →</Link>
        </div>
      </div>

      {/* ── Roster section ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f0f0f0' }}>
            Roster
          </h2>
          <ExportMenu
            formats={['xlsx', 'csv', 'pdf']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            pdfHint="Names, numbers and positions — safe to pin up"
            /* The surface's own gate rather than the generic `pdf_exports` default — the same
               note as the tryouts and House League menus: leaving it to the default would ask
               for a LOWER bar than the exports beside it already sit behind. */
            pdfFeatureKey="club_exports"
            planId={currentOrg?.planId}
            disabled={players.length === 0}
          />
        </div>

        {rosterFetching && (
          <p className={styles.muted}>Loading roster…</p>
        )}

        {!rosterFetching && players.length === 0 && (
          <p className={styles.muted}>No players on this roster yet.</p>
        )}

        {!rosterFetching && players.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>#</th>
                  <th className={styles.th}>First Name</th>
                  <th className={styles.th}>Last Name</th>
                  <th className={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}>
                    <td className={styles.td} style={{ color: 'var(--white-45)', width: '3rem' }}>
                      {p.playerNumber ?? '—'}
                    </td>
                    <td className={styles.td}>{p.playerFirstName}</td>
                    <td className={styles.td}>{p.playerLastName}</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${
                        p.status === 'active'   ? styles.badgeActive   :
                        p.status === 'inactive' ? styles.badgeDraft    :
                                                  styles.badgeArchived
                      }`}>
                        {ROSTER_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : feedbackType === 'info' ? 'Coming Soon' : 'Error'}
        message={feedbackMsg} type={feedbackType} />
    </div>
  );
}
