'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Lock,
  MapPin,
  Tag,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import TournamentTeamsImportDialog from '@/components/admin/import/TournamentTeamsImportDialog';
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

function buildRegistrationExportUrl(tournamentId: string, format: 'xlsx' | 'csv', orgSlug?: string) {
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registrations/export?format=${format}${orgParam}`;
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
  const [notice, setNotice] = useState<Notice | null>(null);

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
  const canUseTeamImports = currentOrg ? hasPlanFeature(currentOrg.planId, 'bulk_data_imports') : false;
  const canUseRegistrationExport = currentOrg ? hasPlanFeature(currentOrg.planId, 'registration_export') : false;
  const canManageTeamImports = userRole
    ? hasCapability(userRole, userCapabilities, 'manage_registrations') ||
      hasCapability(userRole, userCapabilities, 'create_tournaments')
    : false;
  const importPlanCopy = requiresPlanCopy('bulk_data_imports');
  const registrationExportCopy = requiresPlanCopy('registration_export');
  const contextLoading = loading || orgLoading;

  const templateUnavailableReason = contextLoading
    ? 'Loading data tools.'
    : !currentTournament
    ? 'Choose a tournament before downloading team import templates.'
    : !canUseTeamImports
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

  const templateDisabled = Boolean(templateUnavailableReason);
  const importDisabled = Boolean(importUnavailableReason);
  const registrationExportDisabled = Boolean(registrationExportUnavailableReason);

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
                    <p>Open the schedule workspace to export XLSX, CSV, PDF, or iCal from the active schedule view.</p>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <PageLink href={scheduleHref} icon={<ExternalLink size={15} aria-hidden />} disabled={!orgSlug}>
                    Open schedule exports
                  </PageLink>
                  <p className={styles.subtleNote}>Schedule imports stay disabled until the add/update rules are ready for games, venues, pools, and playoff dependencies.</p>
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
        onCommitted={() => {
          setNotice({
            type: 'success',
            message: 'Teams updated. Templates and exports now use the latest tournament data.',
          });
        }}
      />
    </main>
  );
}
