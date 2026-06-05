'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Lock,
  RefreshCw,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { getBillingHref } from '@/lib/billing-urls';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import TournamentTeamsImportDialog from '@/components/admin/import/TournamentTeamsImportDialog';
import TournamentScheduleImportDialog from '@/components/admin/import/TournamentScheduleImportDialog';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import {
  ToolbarGroup,
  ToolbarMenu,
  ToolbarMenuItem,
  ToolbarSelect,
  TournamentAdminHeader,
  TournamentAdminToolbar,
} from '@/components/admin/tournament';
import s from '../../admin-common.module.css';
import styles from './data-tools.module.css';

type Notice = {
  type: 'success' | 'warning';
  message: string;
};

type ImportHistoryStatus = 'previewed' | 'committed' | 'failed' | 'expired';

type ImportHistoryItem = {
  id: string;
  importLabel: string;
  status: ImportHistoryStatus;
  sourceFilename: string | null;
  actorEmail: string | null;
  createdAt: string;
  committedAt: string | null;
  expiresAt: string;
  summary: {
    totalRows: number;
    creates: number;
    updates: number;
    unchanged: number;
    warnings: number;
    blocked: number;
    commit: {
      created: number;
      updated: number;
      unchanged: number;
      skipped: number;
    } | null;
  };
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

/** Navigate to a file-download endpoint (no-op when blocked or no URL). */
function downloadFile(url: string, blocked = false) {
  if (blocked || !url || url === '#') return;
  window.location.href = url;
}

function buildTemplateUrl(
  tournamentId: string,
  mode: 'current' | 'empty',
  format: 'xlsx' | 'csv',
  orgSlug?: string,
) {
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/import/template?mode=${mode}&format=${format}${orgParam}`;
}

function buildScheduleTemplateUrl(
  tournamentId: string,
  mode: 'current' | 'empty',
  format: 'xlsx' | 'csv',
  orgSlug?: string,
) {
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/schedule/import/template?mode=${mode}&format=${format}${orgParam}`;
}

function buildRegistrationExportUrl(tournamentId: string, format: 'xlsx' | 'csv', orgSlug?: string) {
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/export?format=${format}${orgParam}`;
}

function buildImportHistoryUrl(tournamentId: string, orgSlug?: string) {
  const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}&limit=8` : '?limit=8';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/imports/history${orgParam}`;
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not applied';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusMeta(status: ImportHistoryStatus) {
  switch (status) {
    case 'committed':
      return { label: 'Applied', icon: CheckCircle2, className: styles.historyStatusSuccess };
    case 'failed':
      return { label: 'Failed', icon: XCircle, className: styles.historyStatusDanger };
    case 'expired':
      return { label: 'Expired', icon: Clock, className: styles.historyStatusMuted };
    case 'previewed':
    default:
      return { label: 'Preview only', icon: Clock, className: styles.historyStatusWarning };
  }
}

function historyCountItems(item: ImportHistoryItem) {
  if (item.status === 'committed' && item.summary.commit) {
    return [
      { label: 'created', value: item.summary.commit.created },
      { label: 'updated', value: item.summary.commit.updated },
      { label: 'unchanged', value: item.summary.commit.unchanged },
      { label: 'skipped', value: item.summary.commit.skipped },
    ].filter(count => count.value > 0 || count.label === 'unchanged');
  }

  return [
    { label: 'rows', value: item.summary.totalRows },
    { label: 'creates', value: item.summary.creates },
    { label: 'updates', value: item.summary.updates },
    { label: 'unchanged', value: item.summary.unchanged },
    { label: 'warnings', value: item.summary.warnings },
    { label: 'blocked', value: item.summary.blocked },
  ].filter(count => count.value > 0 || count.label === 'rows');
}

export default function TournamentDataToolsPage() {
  const { currentOrg, userRole, userCapabilities, loading: orgLoading } = useOrg();
  const {
    tournaments,
    currentTournament,
    isLocked,
    loading,
    setCurrentTournament,
  } = useTournament();
  const [importOpen, setImportOpen] = useState(false);
  const [templateFormat, setTemplateFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scheduleImportOpen, setScheduleImportOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  usePageTitle('Data Tools');

  const tournamentOptions = useMemo(
    () => tournaments.map(tournament => ({
      value: tournament.id,
      label: `${tournament.name} (${tournament.year})`,
    })),
    [tournaments],
  );

  const orgSlug = currentOrg?.slug;
  const tournamentId = currentTournament?.id ?? '';
  const helpHref = orgSlug ? `/${orgSlug}/admin/help/tournaments#data-tools-imports` : '#';
  const billingHref = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : '#';
  const canUseBulkImports = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_data_imports') : false;
  const canUseRegistrationExport = currentOrg ? hasPlanFeature(currentOrg.planId, 'registration_export') : false;
  const canManageTeamImports = userRole
    ? hasCapability(userRole, userCapabilities, 'manage_registrations') ||
      hasCapability(userRole, userCapabilities, 'create_tournaments')
    : false;
  const canManageScheduleImports = userRole
    ? hasCapability(userRole, userCapabilities, 'manage_schedule_structure') ||
      hasCapability(userRole, userCapabilities, 'update_schedule') ||
      hasCapability(userRole, userCapabilities, 'create_tournaments')
    : false;
  const importPlanCopy = requiresPlanCopy('bulk_data_imports');
  const registrationExportCopy = requiresPlanCopy('registration_export');
  const contextLoading = loading || orgLoading;
  const showPlanGate = Boolean(currentOrg && (!canUseBulkImports || !canUseRegistrationExport));

  const templateUnavailableReason = contextLoading
    ? 'Loading data tools.'
    : !currentTournament
    ? 'Choose a tournament before downloading team import templates.'
    : !canUseBulkImports
      ? importPlanCopy
      : !canManageTeamImports
        ? 'Your role can view tournament data, but cannot download import templates.'
        : null;
  const importUnavailableReason = templateUnavailableReason ??
    (isLocked ? 'Completed tournaments are read-only. Set the tournament back to Active before importing teams.' : null);
  const registrationExportUnavailableReason = contextLoading
    ? 'Loading data tools.'
    : !currentTournament
    ? 'Choose a tournament before exporting teams.'
    : !canUseRegistrationExport
      ? registrationExportCopy
      : null;
  const scheduleTemplateUnavailableReason = contextLoading
    ? 'Loading data tools.'
    : !currentTournament
    ? 'Choose a tournament before downloading schedule import templates.'
    : !canUseBulkImports
      ? importPlanCopy
      : !canManageScheduleImports
        ? 'Your role can view schedules, but cannot download schedule import templates.'
        : null;
  const scheduleImportUnavailableReason = scheduleTemplateUnavailableReason ??
    (isLocked ? 'Completed tournaments are read-only. Set the tournament back to Active before importing schedule rows.' : null);

  const templateDisabled = Boolean(templateUnavailableReason);
  const importDisabled = Boolean(importUnavailableReason);
  const registrationExportDisabled = Boolean(registrationExportUnavailableReason);
  const scheduleTemplateDisabled = Boolean(scheduleTemplateUnavailableReason);
  const scheduleImportDisabled = Boolean(scheduleImportUnavailableReason);
  const historyUnavailableReason = contextLoading
    ? 'Loading import history.'
    : !currentTournament
    ? 'Choose a tournament before viewing import history.'
    : !canUseBulkImports
      ? importPlanCopy
      : !canManageTeamImports && !canManageScheduleImports
        ? 'Your role can view tournament data, but cannot view import history.'
        : null;

  const loadImportHistory = useCallback(async (signal?: AbortSignal) => {
    if (!tournamentId || !orgSlug || historyUnavailableReason) {
      setImportHistory([]);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(buildImportHistoryUrl(tournamentId, orgSlug), {
        credentials: 'same-origin',
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      if (!res.ok) throw new Error(data.error ?? 'Import history could not be loaded.');
      setImportHistory(Array.isArray(data.imports) ? data.imports as ImportHistoryItem[] : []);
    } catch (error) {
      if (signal?.aborted) return;
      setImportHistory([]);
      setHistoryError(error instanceof Error ? error.message : 'Import history could not be loaded.');
    } finally {
      if (!signal?.aborted) setHistoryLoading(false);
    }
  }, [historyUnavailableReason, orgSlug, tournamentId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadImportHistory(controller.signal));
    return () => controller.abort();
  }, [loadImportHistory]);

  function chooseTournament(tournamentIdValue: string) {
    const nextTournament = tournaments.find(tournament => tournament.id === tournamentIdValue);
    if (nextTournament) {
      setCurrentTournament(nextTournament);
      setNotice(null);
    }
  }

  function openTeamsImport() {
    if (importUnavailableReason) {
      setNotice({ type: 'warning', message: importUnavailableReason });
      return;
    }
    setNotice(null);
    setImportOpen(true);
  }

  function openScheduleImport() {
    if (scheduleImportUnavailableReason) {
      setNotice({ type: 'warning', message: scheduleImportUnavailableReason });
      return;
    }
    setNotice(null);
    setScheduleImportOpen(true);
  }

  return (
    <main className={cx(s.page, styles.page)}>
      <TournamentAdminHeader
        icon={<Database size={22} aria-hidden />}
        eyebrow="Tournament Admin"
        title="Data Tools"
        subtitle="Templates, spreadsheet imports, and bulk exports for the selected tournament."
        locked={isLocked}
      />

      <TournamentAdminToolbar ariaLabel="Data tools controls">
        <ToolbarGroup grow>
          <ToolbarSelect
            label="Tournament"
            value={currentTournament?.id ?? ''}
            options={tournamentOptions}
            onChange={chooseTournament}
            disabled={contextLoading || tournamentOptions.length === 0}
          />
        </ToolbarGroup>
      </TournamentAdminToolbar>

      <section className={styles.guidanceStrip} aria-labelledby="import-guidance-heading">
        <div className={styles.guidanceIcon}>
          <CheckCircle2 size={20} aria-hidden />
        </div>
        <div className={styles.guidanceBody}>
          <div className={styles.guidanceHeader}>
            <div>
              <h2 id="import-guidance-heading">Safe spreadsheet imports</h2>
              <p>Uploads create a preview first. Tournament data changes only after an admin applies a clean preview.</p>
            </div>
            {orgSlug ? (
              <Link
                className={styles.guidanceLink}
                href={helpHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Import guide (opens in a new tab)"
              >
                <HelpCircle size={15} aria-hidden />
                <span>Import guide</span>
              </Link>
            ) : (
              <button type="button" className={styles.guidanceLink} disabled>
                <HelpCircle size={15} aria-hidden />
                <span>Import guide</span>
              </button>
            )}
          </div>
          <div className={styles.guidancePoints}>
            <span>Current templates include IDs for safer updates.</span>
            <span>Empty templates are for new rows.</span>
            <span>Blocked rows must be fixed before apply.</span>
            <span>Plan, role, and completed-tournament locks are enforced server-side.</span>
          </div>
        </div>
      </section>

      {showPlanGate && (
        <section className={styles.planGateStrip} aria-label="Tournament Plus data tools">
          <div className={styles.planGateIcon}>
            <Lock size={18} aria-hidden />
          </div>
          <div className={styles.planGateBody}>
            <h2>Unlock import/export workflows</h2>
            <p>{importPlanCopy} Registration exports are also included with Tournament Plus and higher.</p>
          </div>
          <Link className={styles.planGateLink} href={billingHref}>
            <span>Review Tournament Plus</span>
            <ExternalLink size={14} aria-hidden />
          </Link>
        </section>
      )}

      {notice && (
        <div className={cx(styles.notice, notice.type === 'success' ? styles.noticeSuccess : styles.noticeWarning)} role="status">
          {notice.type === 'success'
            ? <CheckCircle2 size={16} aria-hidden />
            : <AlertCircle size={16} aria-hidden />}
          <span>{notice.message}</span>
        </div>
      )}

      {!contextLoading && tournaments.length === 0 ? (
        <section className={styles.emptyState}>
          <Database size={24} aria-hidden />
          <h2>No tournaments available</h2>
          <p>Create or restore a tournament before using import and export tools.</p>
        </section>
      ) : (
        <>
          <CollapsibleCard
            title="Import & Export"
            icon={<Database size={18} aria-hidden />}
            defaultOpen
          >
            <p className={styles.cardLede}>
              Download a template, fill it in, then import. Imports preview first — nothing changes until you apply a clean preview.
            </p>
            <div className={styles.toolMenus}>
              <ToolbarMenu label="Import" icon={<Upload size={15} aria-hidden />} align="start" keepLabel>
                <ToolbarMenuItem
                  icon={<Users size={16} aria-hidden />}
                  label="Teams"
                  hint="Add or update team rows"
                  locked={importDisabled}
                  lockTitle={importUnavailableReason ?? undefined}
                  onSelect={openTeamsImport}
                />
                <ToolbarMenuItem
                  icon={<Calendar size={16} aria-hidden />}
                  label="Schedule"
                  hint="Add or update game rows"
                  locked={scheduleImportDisabled}
                  lockTitle={scheduleImportUnavailableReason ?? undefined}
                  onSelect={openScheduleImport}
                />
              </ToolbarMenu>

              <ToolbarMenu label="Export" icon={<Download size={15} aria-hidden />} align="start" keepLabel>
                <ToolbarMenuItem
                  icon={<FileSpreadsheet size={16} aria-hidden />}
                  label="Registration workbook (XLSX)"
                  locked={registrationExportDisabled}
                  lockTitle={registrationExportUnavailableReason ?? undefined}
                  onSelect={() => downloadFile(buildRegistrationExportUrl(tournamentId, 'xlsx', orgSlug), registrationExportDisabled)}
                />
                <ToolbarMenuItem
                  icon={<FileText size={16} aria-hidden />}
                  label="Registration workbook (CSV)"
                  locked={registrationExportDisabled}
                  lockTitle={registrationExportUnavailableReason ?? undefined}
                  onSelect={() => downloadFile(buildRegistrationExportUrl(tournamentId, 'csv', orgSlug), registrationExportDisabled)}
                />
              </ToolbarMenu>

            </div>

            <div className={styles.templatesBlock}>
              <div className={styles.templatesHead}>
                <span className={styles.templatesLabel}>Templates</span>
                <div className={styles.formatToggle} role="group" aria-label="Template file format">
                  {(['xlsx', 'csv'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      data-active={templateFormat === f || undefined}
                      onClick={() => setTemplateFormat(f)}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.templateGrid}>
                <span className={styles.templateRowLabel}><Users size={14} aria-hidden /> Teams</span>
                <button type="button" className="btn btn-outline btn-data" disabled={templateDisabled} title={templateUnavailableReason ?? undefined} onClick={() => downloadFile(buildTemplateUrl(tournamentId, 'current', templateFormat, orgSlug), templateDisabled)}>Current</button>
                <button type="button" className="btn btn-outline btn-data" disabled={templateDisabled} title={templateUnavailableReason ?? undefined} onClick={() => downloadFile(buildTemplateUrl(tournamentId, 'empty', templateFormat, orgSlug), templateDisabled)}>Empty</button>

                <span className={styles.templateRowLabel}><Calendar size={14} aria-hidden /> Schedule</span>
                <button type="button" className="btn btn-outline btn-data" disabled={scheduleTemplateDisabled} title={scheduleTemplateUnavailableReason ?? undefined} onClick={() => downloadFile(buildScheduleTemplateUrl(tournamentId, 'current', templateFormat, orgSlug), scheduleTemplateDisabled)}>Current</button>
                <button type="button" className="btn btn-outline btn-data" disabled={scheduleTemplateDisabled} title={scheduleTemplateUnavailableReason ?? undefined} onClick={() => downloadFile(buildScheduleTemplateUrl(tournamentId, 'empty', templateFormat, orgSlug), scheduleTemplateDisabled)}>Empty</button>
              </div>
              <p className={styles.subtleNote} style={{ marginTop: '0.55rem' }}>
                <strong style={{ color: 'var(--white-70)' }}>Current</strong> includes existing IDs for safe updates · <strong style={{ color: 'var(--white-70)' }}>Empty</strong> is a blank template for new rows.
              </p>
            </div>
            <p className={styles.cardHint}>Schedule &amp; results spreadsheet exports live in their own workspaces.</p>
          </CollapsibleCard>

          <CollapsibleCard
            title="Recent Imports"
            icon={<History size={18} aria-hidden />}
            defaultOpen={false}
          >
            <div className={styles.historyToolbar}>
              <button
                type="button"
                className="btn btn-ghost btn-data"
                onClick={() => { void loadImportHistory(); }}
                disabled={historyLoading || Boolean(historyUnavailableReason)}
              >
                <RefreshCw size={13} aria-hidden /> Refresh
              </button>
            </div>

            {contextLoading || historyLoading ? (
              <div className={styles.historyState}>
                <RefreshCw size={16} aria-hidden />
                <span>Loading recent imports...</span>
              </div>
            ) : historyUnavailableReason ? (
              <div className={styles.historyState}>
                <Lock size={16} aria-hidden />
                <span>{historyUnavailableReason}</span>
              </div>
            ) : historyError ? (
              <div className={cx(styles.historyState, styles.historyStateWarning)}>
                <AlertCircle size={16} aria-hidden />
                <span>{historyError}</span>
              </div>
            ) : importHistory.length === 0 ? (
              <div className={styles.historyState}>
                <History size={16} aria-hidden />
                <span>No import activity yet for this tournament.</span>
              </div>
            ) : (
              <div className={styles.historyList}>
                {importHistory.map(item => {
                  const meta = statusMeta(item.status);
                  const StatusIcon = meta.icon;
                  return (
                    <article key={item.id} className={styles.historyRow}>
                      <div className={styles.historyMain}>
                        <div className={styles.historyTitleRow}>
                          <History size={15} aria-hidden />
                          <strong>{item.importLabel}</strong>
                          <span className={cx(styles.historyStatus, meta.className)}>
                            <StatusIcon size={13} aria-hidden />
                            {meta.label}
                          </span>
                        </div>
                        <div className={styles.historyMeta}>
                          <span className={styles.historyFile}>{item.sourceFilename || 'Uploaded spreadsheet'}</span>
                          <span>Started {formatDateTime(item.createdAt)}</span>
                          {item.status === 'committed' && <span>Applied {formatDateTime(item.committedAt)}</span>}
                          {item.status === 'previewed' && <span>Expires {formatDateTime(item.expiresAt)}</span>}
                        </div>
                        <div className={styles.historyMeta}>
                          <span>{item.actorEmail || 'Unknown admin'}</span>
                        </div>
                      </div>
                      <div className={styles.historyCounts}>
                        {historyCountItems(item).map(count => (
                          <span key={count.label} className={styles.historyCount}>
                            <strong>{count.value}</strong>
                            <span>{count.label}</span>
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CollapsibleCard>
        </>
      )}

      <TournamentTeamsImportDialog
        open={importOpen}
        tournamentId={tournamentId}
        orgSlug={orgSlug}
        onClose={() => setImportOpen(false)}
        onCommitted={async () => {
          setNotice({
            type: 'success',
            message: 'Teams updated. Templates and exports now use the latest tournament data.',
          });
          await loadImportHistory();
        }}
      />
      <TournamentScheduleImportDialog
        open={scheduleImportOpen}
        tournamentId={tournamentId}
        orgSlug={orgSlug}
        onClose={() => setScheduleImportOpen(false)}
        onPreviewed={async () => {
          setNotice({
            type: 'success',
            message: 'Schedule preview created. No schedule data was changed.',
          });
          await loadImportHistory();
        }}
        onCommitted={async () => {
          setNotice({
            type: 'success',
            message: 'Schedule updated. Templates and exports now use the latest tournament data.',
          });
          await loadImportHistory();
        }}
      />
    </main>
  );
}
