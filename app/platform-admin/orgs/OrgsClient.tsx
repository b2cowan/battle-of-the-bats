'use client';
import { useEffect, useState } from 'react';
import { takeListSearch } from '@/lib/console-recent';
import Link from 'next/link';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { fmtAbsoluteDate } from '@/lib/format-date';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import LinkRow from '../LinkRow';
import kit from '../console.module.css';
import { SUBSCRIPTION_STATUS_LABELS, subscriptionStatusChip, subscriptionStatusLabel } from '../chips';

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
  /** A Coaches Portal staff gave free time (Stage 4b): never a cancelled customer. */
  isFreeTimePortal: boolean;
  isFreeFloor: boolean;
  missingOwner: boolean;
  ownerInactive: boolean;
  expiringSoonOverride: boolean;
  trialEndingSoon: boolean;
  emptyOrg: boolean;
  /** The club's own web address, so support can find who holds one (Club Tier Stage 4e). */
  ownAddress: string | null;
}

interface Props {
  orgs: OrgRow[];
  initialStatus: string;
  initialFilter: string;
}

// Attention filters drilled into from the dashboard Action Queue (?filter=…)
const ATTENTION_LABELS: Record<string, string> = {
  trial_ending:       'Trials ending soon',
  expiring_overrides: 'Overrides expiring soon',
  no_owner:           'Missing owner',
  owner_inactive:     'Owner inactive',
};

function matchesAttentionFilter(org: OrgRow, filter: string): boolean {
  if (filter === 'trial_ending')       return org.trialEndingSoon;
  if (filter === 'expiring_overrides') return org.expiringSoonOverride;
  if (filter === 'no_owner')           return org.missingOwner;
  if (filter === 'owner_inactive')     return org.ownerInactive;
  return true;
}

const PLANS = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'] as const;
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const PLAN_LABELS: Record<string, string> = {
  tournament:      'Tournament',
  team:            'Coaches Portal',
  tournament_plus: 'Tournament Plus',
  league:          'League Plus',
  club:            'Club',
  club_large:      'Club · Association',
};

const fmtDate = (iso: string) => fmtAbsoluteDate(iso);

export default function OrgsClient({ orgs, initialStatus, initialFilter }: Props) {
  const [search,              setSearch]              = useState('');
  const [planFilter,          setPlanFilter]          = useState('');
  const [statusFilter,        setStatusFilter]        = useState(initialStatus);
  const [foundingSeasonOnly,  setFoundingSeasonOnly]  = useState(false);
  const [freeFloorOnly,       setFreeFloorOnly]       = useState(false);
  const [emptyOrgOnly,        setEmptyOrgOnly]        = useState(initialFilter === 'empty_orgs');
  const [attentionFilter,     setAttentionFilter]     = useState(
    ATTENTION_LABELS[initialFilter] ? initialFilter : '',
  );
  // Find's "All N in Clubs & portals" door hands its words over through this tab's session storage, never the address
  // (Support console Stage 2): picked up once, after the first paint.
  useEffect(() => {
    const handed = takeListSearch('clubs');
    if (handed) setSearch(handed);
  }, []);

  // A portal staff gave free time is stored cancelled for its whole life (Stage 4b, T35): it is not a cancelled
  // customer, so neither the count, the callout nor the Cancelled filter counts it. It stays in the list and in search.
  const isCancelledCustomer = (org: OrgRow) => org.subscriptionStatus === 'canceled' && !org.isFreeTimePortal;
  const statusCounts = orgs.reduce<Record<string, number>>((acc, org) => {
    if (org.subscriptionStatus === 'canceled' && !isCancelledCustomer(org)) return acc;
    acc[org.subscriptionStatus] = (acc[org.subscriptionStatus] ?? 0) + 1;
    return acc;
  }, {});
  const pastDueCount = statusCounts.past_due ?? 0;
  const canceledCount = statusCounts.canceled ?? 0;
  const notesCount = orgs.filter(org => org.internalNotes).length;
  const activeOrTrialing = (statusCounts.active ?? 0) + (statusCounts.trialing ?? 0);
  const foundingSeasonCount = orgs.filter(org => org.isFoundingSeason).length;
  const freeFloorCount = orgs.filter(org => org.isFreeFloor).length;
  const emptyOrgCount = orgs.filter(org => org.emptyOrg).length;

  const filteredOrgs = orgs.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!o.name.toLowerCase().includes(q) && !o.slug.toLowerCase().includes(q) && !(o.ownAddress ?? '').includes(q)) return false;
    }
    if (planFilter         && o.planId             !== planFilter)   return false;
    if (statusFilter       && o.subscriptionStatus !== statusFilter) return false;
    if (statusFilter === 'canceled' && !isCancelledCustomer(o)) return false;
    if (foundingSeasonOnly && !o.isFoundingSeason)                   return false;
    if (freeFloorOnly      && !o.isFreeFloor)                        return false;
    if (emptyOrgOnly       && !o.emptyOrg)                           return false;
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
    <div className={kit.page}>
      <AdminPageHeader title="Clubs & portals" />

      <section className={kit.band} aria-label="Organization account snapshot">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Total accounts</span>
          <strong className={kit.bandValue}>{orgs.length}</strong>
        </div>
        <div className={`${kit.bandCell} ${pastDueCount > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>Past due</span>
          <strong className={kit.bandValue}>{pastDueCount}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Active / trial</span>
          <strong className={kit.bandValue}>{activeOrTrialing}</strong>
        </div>
        <div className={`${kit.bandCell} ${foundingSeasonCount > 0 ? kit.bandGood : ''}`}>
          <span className={kit.bandLabel}>Founding season</span>
          <strong className={kit.bandValue}>{foundingSeasonCount}</strong>
        </div>
        <div className={`${kit.bandCell} ${freeFloorCount > 0 ? kit.bandGood : ''}`}>
          <span className={kit.bandLabel}>Free League Starter</span>
          <strong className={kit.bandValue}>{freeFloorCount}</strong>
        </div>
        <button
          type="button"
          className={`${kit.bandCell} ${emptyOrgCount > 0 ? kit.bandWarn : ''} ${emptyOrgOnly ? kit.bandOn : ''}`}
          onClick={() => setEmptyOrgOnly(v => !v)}
          title="Orgs with no tournaments, leagues, rep teams, or members beyond the owner"
          aria-pressed={emptyOrgOnly}
        >
          <span className={kit.bandLabel}>Empty orgs</span>
          <strong className={kit.bandValue}>{emptyOrgCount}</strong>
        </button>
      </section>

      <div className={`${kit.callout} ${pastDueCount > 0 || canceledCount > 0 ? kit.calloutWarn : ''}`}>
        <span>
          <strong>Needs attention.</strong>{' '}
          {pastDueCount > 0 || canceledCount > 0
            ? 'Accounts with billing or access risk are ready for review.'
            : 'No past-due or cancelled accounts in the current directory.'}
        </span>
        <span className={kit.calloutEnd}>
          {pastDueCount > 0 && (
            <button type="button" onClick={() => setStatusFilter('past_due')} className="btn btn-secondary btn-sm">
              Past due ({pastDueCount})
            </button>
          )}
          {canceledCount > 0 && (
            <button type="button" onClick={() => setStatusFilter('canceled')} className="btn btn-secondary btn-sm">
              Cancelled ({canceledCount})
            </button>
          )}
          {pastDueCount === 0 && canceledCount === 0 && <span className={kit.chipOk + ' ' + kit.chip}>Clear</span>}
        </span>
      </div>

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Account directory</h2>
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {filteredOrgs.length === orgs.length
                ? `${orgs.length} accounts`
                : `${filteredOrgs.length} of ${orgs.length} accounts`}
            </span>
            <span className={kit.toolbarEnd}>
              <Link href="/platform-admin/customer-users" className={kit.door}>Search customer users ›</Link>
              <ExportMenu
                formats={['xlsx', 'csv']}
                onExportXLSX={handleExportXLSX}
                onExportCSV={handleExportCSV}
                disabled={filteredOrgs.length === 0}
              />
            </span>
          </div>
          <div className={kit.toolbar}>
            <input
              type="search"
              className={kit.search}
              placeholder="Search name, slug or web address"
              aria-label="Search organizations"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className={kit.select}
              aria-label="Plan"
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
            >
              <option value="">All plans</option>
              {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
            </select>
            <select
              className={kit.select}
              aria-label="Status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{SUBSCRIPTION_STATUS_LABELS[s]}</option>)}
            </select>
            <label className={kit.check}>
              <input
                type="checkbox"
                checked={foundingSeasonOnly}
                onChange={e => setFoundingSeasonOnly(e.target.checked)}
              />
              <span>Founding season only</span>
            </label>
            <label className={kit.check}>
              <input
                type="checkbox"
                checked={freeFloorOnly}
                onChange={e => setFreeFloorOnly(e.target.checked)}
              />
              <span>League Starter only</span>
            </label>
            <label className={kit.check}>
              <input
                type="checkbox"
                checked={emptyOrgOnly}
                onChange={e => setEmptyOrgOnly(e.target.checked)}
              />
              <span>Empty orgs only</span>
            </label>
            {attentionFilter && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAttentionFilter('')}
                title="Clear attention filter"
              >
                {ATTENTION_LABELS[attentionFilter]} ✕
              </button>
            )}
            {(search || planFilter || statusFilter || foundingSeasonOnly || freeFloorOnly || emptyOrgOnly || attentionFilter) && (
              <button
                type="button"
                className={kit.door}
                onClick={() => { setSearch(''); setPlanFilter(''); setStatusFilter(''); setFoundingSeasonOnly(false); setFreeFloorOnly(false); setEmptyOrgOnly(false); setAttentionFilter(''); }}
              >
                Clear
              </button>
            )}
          </div>

          {/* `table-cards` (global, app/globals.css): a LIST becomes cards at ≤640 — the console had no
              phone shape at all and this table scrolled sideways with rows wrapping to 121px (table
              standard, register F-12). The name is the card's title and takes no label. */}
          <div className={`${kit.tableWrap} table-cards`}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Cohort</th>
                  <th>Created</th>
                  <th aria-label="Open"></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={7} className={kit.empty}>No organizations match the current filter.</td>
                  </tr>
                )}
                {filteredOrgs.map(org => (
                  <LinkRow key={org.id} href={`/platform-admin/orgs/${org.id}`}>
                    <td className="table-cards-title">
                      <Link href={`/platform-admin/orgs/${org.id}`} className={kit.nameLink}>{org.name}</Link>
                      {org.internalNotes && (
                        <>{' '}<span className={kit.chip} title="Has internal note">Note</span></>
                      )}
                    </td>
                    <td data-label="Slug"><span className={kit.code}>{org.slug}</span></td>
                    <td data-label="Plan" className={kit.nowrap}>{PLAN_LABELS[org.planId] ?? org.planId}</td>
                    <td data-label="Status">
                      <span className={`${kit.chip} ${subscriptionStatusChip(org.subscriptionStatus)}`}>
                        {subscriptionStatusLabel(org.subscriptionStatus)}
                      </span>
                    </td>
                    <td data-label="Cohort">
                      {org.isFreeFloor && (
                        <span className={`${kit.chip} ${kit.chipOk}`} title="Free League Starter floor (plan_id stays 'tournament')">
                          League Starter
                        </span>
                      )}{' '}
                      {org.isFoundingSeason && (
                        <span className={`${kit.chip} ${kit.chipOk}`}>Founding</span>
                      )}{' '}
                      {org.emptyOrg && (
                        <span className={`${kit.chip} ${kit.chipWarn}`} title="No tournaments, leagues, rep teams, or members beyond the owner">
                          Empty
                        </span>
                      )}
                    </td>
                    <td data-label="Created" className={kit.nowrap}>{fmtDate(org.createdAt)}</td>
                    <td className={kit.rowDoor}><Link href={`/platform-admin/orgs/${org.id}`} tabIndex={-1} aria-hidden="true" className={kit.rowDoorLink}>›</Link></td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
