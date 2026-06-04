'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  MapPin,
  RefreshCw,
  Tag,
  Trophy,
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
import {
  ToolbarGroup,
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

type ActionButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
};

type ActionLinkProps = {
  children: ReactNode;
  href: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  title?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
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

function actionClass(variant: ActionButtonProps['variant'] = 'secondary') {
  return cx(
    styles.actionButton,
    variant === 'primary' && styles.actionPrimary,
    variant === 'ghost' && styles.actionGhost,
  );
}

function ActionButton({
  children,
  icon,
  variant = 'secondary',
  disabled,
  title,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={actionClass(variant)}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function ActionLink({
  children,
  href,
  icon,
  variant = 'secondary',
  disabled,
  title,
}: ActionLinkProps) {
  if (disabled) {
    return (
      <button type="button" className={actionClass(variant)} disabled title={title}>
        {icon}
        <span>{children}</span>
      </button>
    );
  }

  return (
    <a className={actionClass(variant)} href={href} title={title}>
      {icon}
      <span>{children}</span>
    </a>
  );
}

function PageLink({
  children,
  href,
  icon,
  disabled,
}: {
  children: ReactNode;
  href: string;
  icon: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <button type="button" className={actionClass('secondary')} disabled>
        {icon}
        <span>{children}</span>
      </button>
    );
  }

  return (
    <Link className={actionClass('secondary')} href={href}>
      {icon}
      <span>{children}</span>
    </Link>
  );
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
  const scheduleHref = orgSlug ? `/${orgSlug}/admin/tournaments/schedule` : '#';
  const resultsHref = orgSlug ? `/${orgSlug}/admin/tournaments/results` : '#';
  const divisionsHref = orgSlug ? `/${orgSlug}/admin/tournaments/divisions` : '#';
  const venuesHref = orgSlug ? `/${orgSlug}/admin/tournaments/venues` : '#';
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
              <Link className={styles.guidanceLink} href={helpHref}>
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
          <section className={styles.section} aria-labelledby="live-tools-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="live-tools-heading">Available Now</h2>
                <p>Bulk workflows connected to existing tournament data.</p>
              </div>
            </div>

            <div className={styles.toolGrid}>
              <article className={styles.toolCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <Users size={20} aria-hidden />
                  </div>
                  <div>
                    <h3>Teams & Registrations</h3>
                    <p>Add/update team rows, download import templates, or export the registration workbook.</p>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <Upload size={14} aria-hidden />
                      <span>Import</span>
                    </div>
                    <ActionButton
                      variant="primary"
                      icon={<Upload size={15} aria-hidden />}
                      onClick={openTeamsImport}
                      disabled={importDisabled}
                      title={importUnavailableReason ?? undefined}
                    >
                      Add/update teams
                    </ActionButton>
                    {importUnavailableReason && (
                      <p className={styles.lockedNote}>
                        <Lock size={13} aria-hidden />
                        <span>{importUnavailableReason}</span>
                      </p>
                    )}
                  </div>

                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <FileSpreadsheet size={14} aria-hidden />
                      <span>Templates</span>
                    </div>
                    <div className={styles.buttonGrid}>
                      <ActionLink
                        href={tournamentId ? buildTemplateUrl(tournamentId, 'current', 'xlsx', orgSlug) : '#'}
                        icon={<FileSpreadsheet size={15} aria-hidden />}
                        disabled={templateDisabled}
                        title={templateUnavailableReason ?? undefined}
                      >
                        Current XLSX
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildTemplateUrl(tournamentId, 'current', 'csv', orgSlug) : '#'}
                        icon={<FileText size={15} aria-hidden />}
                        disabled={templateDisabled}
                        title={templateUnavailableReason ?? undefined}
                      >
                        Current CSV
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildTemplateUrl(tournamentId, 'empty', 'xlsx', orgSlug) : '#'}
                        icon={<FileSpreadsheet size={15} aria-hidden />}
                        disabled={templateDisabled}
                        title={templateUnavailableReason ?? undefined}
                      >
                        Empty XLSX
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildTemplateUrl(tournamentId, 'empty', 'csv', orgSlug) : '#'}
                        icon={<FileText size={15} aria-hidden />}
                        disabled={templateDisabled}
                        title={templateUnavailableReason ?? undefined}
                      >
                        Empty CSV
                      </ActionLink>
                    </div>
                    <p className={styles.subtleNote}>
                      Current templates include existing team IDs for updates. Empty templates are blank rows for new teams.
                    </p>
                  </div>

                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <Download size={14} aria-hidden />
                      <span>Export</span>
                    </div>
                    <div className={styles.buttonGrid}>
                      <ActionLink
                        href={tournamentId ? buildRegistrationExportUrl(tournamentId, 'xlsx', orgSlug) : '#'}
                        icon={<FileSpreadsheet size={15} aria-hidden />}
                        disabled={registrationExportDisabled}
                        title={registrationExportUnavailableReason ?? undefined}
                      >
                        XLSX workbook
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildRegistrationExportUrl(tournamentId, 'csv', orgSlug) : '#'}
                        icon={<FileText size={15} aria-hidden />}
                        disabled={registrationExportDisabled}
                        title={registrationExportUnavailableReason ?? undefined}
                      >
                        CSV file
                      </ActionLink>
                    </div>
                    {registrationExportUnavailableReason && (
                      <p className={styles.lockedNote}>
                        <Lock size={13} aria-hidden />
                        <span>{registrationExportUnavailableReason}</span>
                      </p>
                    )}
                  </div>
                </div>
              </article>

              <article className={styles.toolCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <Calendar size={20} aria-hidden />
                  </div>
                  <div>
                    <h3>Schedule</h3>
                    <p>Add/update schedule rows, download schedule templates, or open the schedule workspace for exports.</p>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <Upload size={14} aria-hidden />
                      <span>Import</span>
                    </div>
                    <ActionButton
                      variant="primary"
                      icon={<Upload size={15} aria-hidden />}
                      onClick={openScheduleImport}
                      disabled={scheduleImportDisabled}
                      title={scheduleImportUnavailableReason ?? undefined}
                    >
                      Add/update schedule
                    </ActionButton>
                    {scheduleImportUnavailableReason && (
                      <p className={styles.lockedNote}>
                        <Lock size={13} aria-hidden />
                        <span>{scheduleImportUnavailableReason}</span>
                      </p>
                    )}
                    <p className={styles.subtleNote}>Add/update only. Games missing from the file stay unchanged.</p>
                  </div>

                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <FileSpreadsheet size={14} aria-hidden />
                      <span>Templates</span>
                    </div>
                    <div className={styles.buttonGrid}>
                      <ActionLink
                        href={tournamentId ? buildScheduleTemplateUrl(tournamentId, 'current', 'xlsx', orgSlug) : '#'}
                        icon={<FileSpreadsheet size={15} aria-hidden />}
                        disabled={scheduleTemplateDisabled}
                        title={scheduleTemplateUnavailableReason ?? undefined}
                      >
                        Current XLSX
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildScheduleTemplateUrl(tournamentId, 'current', 'csv', orgSlug) : '#'}
                        icon={<FileText size={15} aria-hidden />}
                        disabled={scheduleTemplateDisabled}
                        title={scheduleTemplateUnavailableReason ?? undefined}
                      >
                        Current CSV
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildScheduleTemplateUrl(tournamentId, 'empty', 'xlsx', orgSlug) : '#'}
                        icon={<FileSpreadsheet size={15} aria-hidden />}
                        disabled={scheduleTemplateDisabled}
                        title={scheduleTemplateUnavailableReason ?? undefined}
                      >
                        Empty XLSX
                      </ActionLink>
                      <ActionLink
                        href={tournamentId ? buildScheduleTemplateUrl(tournamentId, 'empty', 'csv', orgSlug) : '#'}
                        icon={<FileText size={15} aria-hidden />}
                        disabled={scheduleTemplateDisabled}
                        title={scheduleTemplateUnavailableReason ?? undefined}
                      >
                        Empty CSV
                      </ActionLink>
                    </div>
                  </div>

                  <div className={styles.actionGroup}>
                    <div className={styles.actionLabel}>
                      <Download size={14} aria-hidden />
                      <span>Export</span>
                    </div>
                    <p className={styles.subtleNote}>Open the schedule workspace to export XLSX, CSV, PDF, or iCal from the active schedule view.</p>
                  </div>
                  <PageLink href={scheduleHref} icon={<ExternalLink size={15} aria-hidden />} disabled={!orgSlug}>
                    Open schedule exports
                  </PageLink>
                </div>
              </article>

              <article className={styles.toolCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <Trophy size={20} aria-hidden />
                  </div>
                  <div>
                    <h3>Results</h3>
                    <p>Open the results workspace to export standings, scores, and PDF-ready result views.</p>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <PageLink href={resultsHref} icon={<ExternalLink size={15} aria-hidden />} disabled={!orgSlug}>
                    Open results exports
                  </PageLink>
                </div>
              </article>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="recent-imports-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="recent-imports-heading">Recent Imports</h2>
                <p>Latest import previews and applies for the selected tournament.</p>
              </div>
              <ActionButton
                variant="ghost"
                icon={<RefreshCw size={15} aria-hidden />}
                onClick={() => { void loadImportHistory(); }}
                disabled={historyLoading || Boolean(historyUnavailableReason)}
              >
                Refresh
              </ActionButton>
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
          </section>

          <section className={styles.section} aria-labelledby="setup-tools-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="setup-tools-heading">Reference Data</h2>
                <p>Setup datasets that will become bulk-edit targets after the team importer settles.</p>
              </div>
            </div>

            <div className={styles.referenceGrid}>
              <article className={styles.referenceItem}>
                <Tag size={17} aria-hidden />
                <div>
                  <h3>Divisions</h3>
                  <p>Use divisions as the reference source for team templates.</p>
                </div>
                <PageLink href={divisionsHref} icon={<ExternalLink size={15} aria-hidden />} disabled={!orgSlug}>
                  Open
                </PageLink>
              </article>

              <article className={styles.referenceItem}>
                <MapPin size={17} aria-hidden />
                <div>
                  <h3>Venues & Facilities</h3>
                  <p>Venue exports and import templates are a later Data Tools expansion.</p>
                </div>
                <PageLink href={venuesHref} icon={<ExternalLink size={15} aria-hidden />} disabled={!orgSlug}>
                  Open
                </PageLink>
              </article>
            </div>
          </section>
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
