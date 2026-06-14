'use client';
import { useState } from 'react';
import Link from 'next/link';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import styles from './orgs.module.css';

// ── Export ────────────────────────────────────────────────────────────────────

const ORGS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Name',            key: 'name',               format: 'text' },
  { label: 'Slug',            key: 'slug',               format: 'text' },
  { label: 'Plan',            key: 'planLabel',          format: 'text' },
  { label: 'Status',          key: 'subscriptionStatus', format: 'text' },
  { label: 'Founding Season', key: 'isFoundingSeason',   format: 'text' },
  { label: 'League Starter',  key: 'isFreeFloor',        format: 'text' },
  { label: 'Created',         key: 'createdAt',          format: 'text' },
];

// ─────────────────────────────────────────────────────────────────────────────

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  planId: string;
  subscriptionStatus: string;
  createdAt: string;
  enabledAddons: string[];
  internalNotes: string | null;
  isFoundingSeason: boolean;
  isFreeFloor: boolean;
  missingOwner: boolean;
  ownerInactive: boolean;
  expiredOverride: boolean;
  trialEndingSoon: boolean;
}

interface Props {
  orgs: OrgRow[];
  initialStatus: string;
  initialFilter: string;
}

// Attention filters drilled into from the dashboard Action Queue (?filter=…)
const ATTENTION_LABELS: Record<string, string> = {
  trial_ending:      'Trials ending soon',
  expired_overrides: 'Expired overrides',
  no_owner:          'Missing owner',
  owner_inactive:    'Owner inactive',
};

function matchesAttentionFilter(org: OrgRow, filter: string): boolean {
  if (filter === 'trial_ending')      return org.trialEndingSoon;
  if (filter === 'expired_overrides') return org.expiredOverride;
  if (filter === 'no_owner')          return org.missingOwner;
  if (filter === 'owner_inactive')    return org.ownerInactive;
  return true;
}

const PLANS = ['tournament', 'team', 'tournament_plus', 'league', 'club'] as const;
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const PLAN_LABELS: Record<string, string> = {
  tournament:      'Tournament',
  team:            'Team',
  tournament_plus: 'Tournament Plus',
  league:          'League Plus',
  club:            'Club',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusClass(status: string) {
  if (status === 'active')   return styles.badgeActive;
  if (status === 'trialing') return styles.badgeTrialing;
  if (status === 'past_due') return styles.badgePastDue;
  return styles.badgeMuted;
}

export default function OrgsClient({ orgs, initialStatus, initialFilter }: Props) {
  const [search,              setSearch]              = useState('');
  const [planFilter,          setPlanFilter]          = useState('');
  const [statusFilter,        setStatusFilter]        = useState(initialStatus);
  const [foundingSeasonOnly,  setFoundingSeasonOnly]  = useState(false);
  const [freeFloorOnly,       setFreeFloorOnly]       = useState(false);
  const [attentionFilter,     setAttentionFilter]     = useState(
    ATTENTION_LABELS[initialFilter] ? initialFilter : '',
  );

  const statusCounts = orgs.reduce<Record<string, number>>((acc, org) => {
    acc[org.subscriptionStatus] = (acc[org.subscriptionStatus] ?? 0) + 1;
    return acc;
  }, {});
  const pastDueCount = statusCounts.past_due ?? 0;
  const canceledCount = statusCounts.canceled ?? 0;
  const notesCount = orgs.filter(org => org.internalNotes).length;
  const activeOrTrialing = (statusCounts.active ?? 0) + (statusCounts.trialing ?? 0);
  const foundingSeasonCount = orgs.filter(org => org.isFoundingSeason).length;
  const freeFloorCount = orgs.filter(org => org.isFreeFloor).length;

  const filteredOrgs = orgs.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.name.toLowerCase().includes(q) && !o.slug.toLowerCase().includes(q)) return false;
    }
    if (planFilter         && o.planId             !== planFilter)   return false;
    if (statusFilter       && o.subscriptionStatus !== statusFilter) return false;
    if (foundingSeasonOnly && !o.isFoundingSeason)                   return false;
    if (freeFloorOnly      && !o.isFreeFloor)                        return false;
    if (attentionFilter    && !matchesAttentionFilter(o, attentionFilter)) return false;
    return true;
  });

  // ── Export ────────────────────────────────────────────────────────────────

  function buildOrgExportRows() {
    return filteredOrgs.map(o => ({
      name:               o.name,
      slug:               o.slug,
      planLabel:          PLAN_LABELS[o.planId] ?? o.planId,
      subscriptionStatus: o.subscriptionStatus,
      isFoundingSeason:   o.isFoundingSeason ? 'Yes' : 'No',
      isFreeFloor:        o.isFreeFloor ? 'Yes' : 'No',
      createdAt:          fmtDate(o.createdAt),
    }));
  }

  function handleExportXLSX() {
    const rows     = buildOrgExportRows();
    const headers  = serializeHeaders(ORGS_EXPORT_COLS);
    const data     = serializeRows(rows, ORGS_EXPORT_COLS);
    const filename = buildFilename({ dataset: 'organizations' }, 'xlsx');
    downloadXLSX(filename, headers, data, 'Organizations');
  }

  function handleExportCSV() {
    const rows     = buildOrgExportRows();
    const headers  = serializeHeaders(ORGS_EXPORT_COLS);
    const data     = serializeRows(rows, ORGS_EXPORT_COLS);
    const filename = buildFilename({ dataset: 'organizations' }, 'csv');
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Customers</div>
          <h1 className={styles.title}>Organizations</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={filteredOrgs.length === 0}
          />
          <div className={styles.count}>
            {filteredOrgs.length === orgs.length
              ? `${orgs.length} total`
              : `${filteredOrgs.length} of ${orgs.length}`}
          </div>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Organization account snapshot">
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total Accounts</span>
          <strong>{orgs.length}</strong>
        </div>
        <div className={`${styles.metric} ${pastDueCount > 0 ? styles.metricWarn : ''}`}>
          <span className={styles.metricLabel}>Past Due</span>
          <strong>{pastDueCount}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Active / Trial</span>
          <strong>{activeOrTrialing}</strong>
        </div>
        <div className={`${styles.metric} ${foundingSeasonCount > 0 ? styles.metricHighlight : ''}`}>
          <span className={styles.metricLabel}>Founding Season</span>
          <strong>{foundingSeasonCount}</strong>
        </div>
        <div className={`${styles.metric} ${freeFloorCount > 0 ? styles.metricHighlight : ''}`}>
          <span className={styles.metricLabel}>Free League Starter</span>
          <strong>{freeFloorCount}</strong>
        </div>
      </section>

      <section className={`${styles.attentionStrip} ${pastDueCount > 0 || canceledCount > 0 ? styles.attentionWarn : ''}`}>
        <div>
          <div className={styles.sectionKicker}>Needs Attention</div>
          <div className={styles.attentionText}>
            {pastDueCount > 0 || canceledCount > 0
              ? 'Accounts with billing or access risk are ready for review.'
              : 'No past-due or canceled accounts in the current directory.'}
          </div>
        </div>
        <div className={styles.attentionActions}>
          {pastDueCount > 0 && (
            <button type="button" onClick={() => setStatusFilter('past_due')} className={styles.attentionBtn}>
              Past due ({pastDueCount})
            </button>
          )}
          {canceledCount > 0 && (
            <button type="button" onClick={() => setStatusFilter('canceled')} className={styles.attentionBtn}>
              Canceled ({canceledCount})
            </button>
          )}
          {pastDueCount === 0 && canceledCount === 0 && (
            <span className={styles.attentionOk}>Clear</span>
          )}
        </div>
      </section>

      <section className={styles.workflowPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionKicker}>Primary Workflow</div>
            <h2 className={styles.sectionTitle}>Find Accounts</h2>
          </div>
          <Link href="/platform-admin/customer-users" className={styles.secondaryAction}>
            Search Customer Users
          </Link>
        </div>

        <div className={styles.filterBar}>
          <input
            type="search"
            className={styles.filterInput}
            placeholder="Search name or slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className={styles.filterSelect}
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
          >
            <option value="">All plans</option>
            {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={foundingSeasonOnly}
              onChange={e => setFoundingSeasonOnly(e.target.checked)}
            />
            Founding Season only
          </label>
          <label className={styles.filterCheckbox}>
            <input
              type="checkbox"
              checked={freeFloorOnly}
              onChange={e => setFreeFloorOnly(e.target.checked)}
            />
            League Starter only
          </label>
          {attentionFilter && (
            <button
              type="button"
              className={styles.attentionBtn}
              onClick={() => setAttentionFilter('')}
              title="Clear attention filter"
            >
              {ATTENTION_LABELS[attentionFilter]} ✕
            </button>
          )}
          {(search || planFilter || statusFilter || foundingSeasonOnly || freeFloorOnly || attentionFilter) && (
            <button
              className={styles.filterClear}
              onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setFoundingSeasonOnly(false); setFreeFloorOnly(false); setAttentionFilter(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      <section className={styles.tableSection}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionKicker}>Grouped Detail</div>
            <h2 className={styles.sectionTitle}>Account Directory</h2>
          </div>
          <div className={styles.sectionMeta}>
            {filteredOrgs.length} shown
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Cohort</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyCell}>No organizations match the current filter.</td>
                </tr>
              )}
              {filteredOrgs.map(org => (
                <tr key={org.id}>
                  <td>
                    <span className={styles.orgName}>{org.name}</span>
                    {org.internalNotes && (
                      <span className={styles.noteIndicator} title="Has internal note">note</span>
                    )}
                  </td>
                  <td><span className={styles.slug}>{org.slug}</span></td>
                  <td>
                    <span className={styles.planLabel}>{PLAN_LABELS[org.planId] ?? org.planId}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${statusClass(org.subscriptionStatus)}`}>
                      {org.subscriptionStatus}
                    </span>
                  </td>
                  <td>
                    {org.isFreeFloor && (
                      <span className={styles.foundingBadge} title="Free League Starter floor (plan_id stays 'tournament')">
                        League Starter
                      </span>
                    )}
                    {org.isFoundingSeason && (
                      <span className={styles.foundingBadge}>Founding</span>
                    )}
                  </td>
                  <td className={styles.dateCell}>{fmtDate(org.createdAt)}</td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actionGroup}>
                      <Link href={`/platform-admin/orgs/${org.id}`} className={styles.viewLink}>
                        View
                      </Link>
                      <Link
                        href={`/${org.slug}/admin`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.adminLink}
                      >
                        Admin
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
