'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ExportMenu from '@/components/admin/ExportMenu';
import HelpCallout from '@/components/help/HelpCallout';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { fmtAbsoluteDate, fmtSince, fmtDaysLeft } from '@/lib/format-date';
import { pluralize } from '@/lib/utils';
// One definition of how a saved card reads, shared with the account's own billing page — the two
// surfaces that show a customer's card must never describe it differently.
import { formatCardOnFile } from '@/lib/billing-format';
import type { FoundingAccountRow } from '@/lib/founding-season-desk';
import styles from './founding-season.module.css';

// ── Export ────────────────────────────────────────────────────────────────────
// Mirrors the columns on screen, in the same order, and respects the filters —
// what the operator exported must be what they were looking at.
const DESK_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Account',          key: 'name',                 format: 'text' },
  { label: 'Slug',             key: 'slug',                 format: 'text' },
  { label: 'Kind',             key: 'kindLabel',            format: 'text' },
  { label: 'Plan',             key: 'planLabel',            format: 'text' },
  { label: 'Free through',     key: 'freeThroughLabel',     format: 'text' },
  { label: 'Card on file',     key: 'cardLabel',            format: 'text' },
  { label: 'Card saved',       key: 'cardSavedLabel',       format: 'text' },
  { label: 'Next season plan', key: 'nextSeasonLabel',      format: 'text' },
  { label: 'Chosen',           key: 'nextSeasonChosenLabel', format: 'text' },
  { label: 'Owner last seen',  key: 'ownerLastSeenLabel',   format: 'text' },
  { label: 'Used it for',      key: 'usageLabel',           format: 'text' },
  { label: 'Billing contact',  key: 'billingContact',       format: 'text' },
];

type Totals = {
  accounts: number; organizations: number; coachesPortals: number; noCard: number; noChoice: number;
};

type Props = {
  rows: FoundingAccountRow[];
  totals: Totals;
  freeSeasonEndsLabel: string;
  nextYearLabel: string;
  freeSeasonEndsIso: string;
  cardWindowOpen: boolean;
};

const KIND_LABEL: Record<FoundingAccountRow['kind'], string> = {
  organization: 'Organization',
  coaches_portal: 'Coaches Portal',
};

function cardLabelFor(row: FoundingAccountRow): string | null {
  if (!row.cardOnFileAt) return null;
  return formatCardOnFile({ brand: row.cardBrand, last4: row.cardLast4 });
}

function nextSeasonLabelFor(row: FoundingAccountRow): string | null {
  if (!row.nextSeasonPlanLabel) return null;
  return row.nextSeasonBillingCycle
    ? `${row.nextSeasonPlanLabel} · ${row.nextSeasonBillingCycle}`
    : row.nextSeasonPlanLabel;
}

export default function FoundingSeasonDeskClient({
  rows, totals, freeSeasonEndsLabel, nextYearLabel, freeSeasonEndsIso, cardWindowOpen,
}: Props) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [noCardOnly, setNoCardOnly] = useState(false);
  const [noChoiceOnly, setNoChoiceOnly] = useState(false);

  const filtered = useMemo(() => rows.filter(row => {
    if (noCardOnly && row.cardOnFileAt) return false;
    if (noChoiceOnly && row.nextSeasonPlanId) return false;
    if (kindFilter && row.kind !== kindFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${row.name} ${row.slug} ${row.billingContact ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }), [rows, search, kindFilter, noCardOnly, noChoiceOnly]);

  const anyFilter = Boolean(search || kindFilter || noCardOnly || noChoiceOnly);

  function buildExportRows() {
    return filtered.map(row => ({
      name: row.name,
      slug: row.slug,
      kindLabel: KIND_LABEL[row.kind],
      planLabel: row.planLabel,
      freeThroughLabel: `${fmtAbsoluteDate(row.freeThrough)}${row.isLegacyExpiry ? ' (legacy)' : ''}`,
      cardLabel: cardLabelFor(row) ?? 'None',
      cardSavedLabel: row.cardOnFileAt ? fmtAbsoluteDate(row.cardOnFileAt) : '',
      nextSeasonLabel: nextSeasonLabelFor(row) ?? 'None',
      nextSeasonChosenLabel: row.nextSeasonChosenAt ? fmtAbsoluteDate(row.nextSeasonChosenAt) : '',
      ownerLastSeenLabel: row.ownerLastSeenAt ? fmtAbsoluteDate(row.ownerLastSeenAt) : 'Never',
      usageLabel: row.usageLabel,
      billingContact: row.billingContact ?? '',
    }));
  }

  function handleExportXLSX() {
    const headers = serializeHeaders(DESK_EXPORT_COLS);
    const data = serializeRows(buildExportRows(), DESK_EXPORT_COLS);
    downloadXLSX(buildFilename({ dataset: 'founding-season' }, 'xlsx'), headers, data, 'Founding Season');
  }

  function handleExportCSV() {
    const headers = serializeHeaders(DESK_EXPORT_COLS);
    const data = serializeRows(buildExportRows(), DESK_EXPORT_COLS);
    downloadCSVBlob(buildFilename({ dataset: 'founding-season' }, 'csv'), generateCSV(headers, data));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Billing &amp; Product</div>
        <h1 className={styles.title}>Founding Season</h1>
        <div className={styles.count}>
          {anyFilter
            ? `${filtered.length} of ${totals.accounts} accounts`
            : `${pluralize(totals.accounts, 'account')} · free through ${freeSeasonEndsLabel}`}
        </div>
      </header>

      <div className={styles.metrics}>
        <div className={`${styles.metric} ${styles.metricHighlight}`}>
          <span className={styles.metricLabel}>Founding accounts</span>
          <strong>{totals.accounts}</strong>
          <span className={styles.metricSub}>
            {pluralize(totals.organizations, 'org')} · {pluralize(totals.coachesPortals, 'portal')}
          </span>
        </div>
        <div className={`${styles.metric} ${totals.noCard > 0 ? styles.metricWarn : ''}`}>
          <span className={styles.metricLabel}>No card yet</span>
          <strong>{totals.noCard}</strong>
          <span className={styles.metricSub}>
            {totals.accounts > 0 ? `${Math.round((totals.noCard / totals.accounts) * 100)}%` : '—'}
          </span>
        </div>
        <div className={`${styles.metric} ${totals.noChoice > 0 ? styles.metricWarn : ''}`}>
          <span className={styles.metricLabel}>No {nextYearLabel} choice yet</span>
          <strong>{totals.noChoice}</strong>
          <span className={styles.metricSub}>
            {totals.accounts > 0 ? `${Math.round((totals.noChoice / totals.accounts) * 100)}%` : '—'}
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Free season ends</span>
          <strong>{freeSeasonEndsLabel}</strong>
          {/* Clock-dependent, so it is read on the CLIENT — a server render would bake in the day
              the page was built. Same rule the console's other freshness figures follow. */}
          <span className={styles.metricSub}>{fmtDaysLeft(freeSeasonEndsIso).trim() || '(ended)'}</span>
        </div>
      </div>

      {!cardWindowOpen && (
        <HelpCallout
          variant="tip"
          title="The summer ask has not opened yet"
          body={`Founding accounts are not asked for a card or a ${nextYearLabel} plan until the card window opens. Until then this desk is a record of who is on the free season and what they are doing with it — the "no card yet" and "no choice yet" columns will fill in over the summer.`}
        />
      )}

      <div className={styles.filterBar}>
        <input
          className={styles.filterInput}
          placeholder="Search account or billing contact…"
          aria-label="Search accounts"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          aria-label="Account kind"
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value)}
        >
          <option value="">All kinds</option>
          <option value="organization">Organizations</option>
          <option value="coaches_portal">Coaches Portals</option>
        </select>
        <button
          type="button"
          className={`${styles.filterBtn} ${noCardOnly ? styles.filterBtnOn : ''}`}
          aria-pressed={noCardOnly}
          onClick={() => setNoCardOnly(v => !v)}
        >
          No card yet
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${noChoiceOnly ? styles.filterBtnOn : ''}`}
          aria-pressed={noChoiceOnly}
          onClick={() => setNoChoiceOnly(v => !v)}
        >
          No {nextYearLabel} choice
        </button>
        <ExportMenu
          formats={['xlsx', 'csv']}
          onExportXLSX={handleExportXLSX}
          onExportCSV={handleExportCSV}
          disabled={filtered.length === 0}
        />
        {anyFilter && (
          <button
            type="button"
            className={styles.filterClear}
            onClick={() => { setSearch(''); setKindFilter(''); setNoCardOnly(false); setNoChoiceOnly(false); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <HelpCallout
          variant="tip"
          title={rows.length === 0 ? 'No founding accounts' : 'Nothing matches these filters'}
          body={rows.length === 0
            ? 'No account currently holds a Founding Season comp. Accounts appear here as they sign up during the offer window.'
            : 'Clear the filters to see every founding account.'}
        />
      ) : (
        <div className={`${styles.tableWrap} table-cards`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Kind</th>
                <th>Plan</th>
                <th>Free through</th>
                <th>Card on file</th>
                <th>{nextYearLabel} choice</th>
                <th>Owner last seen</th>
                <th>Used it for</th>
                <th>Billing contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const card = cardLabelFor(row);
                return (
                  <tr key={row.orgId}>
                    {/* The lead cell is the card's title on a phone and takes no label. */}
                    <td>
                      <span className={styles.acct}>
                        <Link href={`/platform-admin/orgs/${row.orgId}?tab=billing`} className={styles.acctLink}>
                          {row.name}
                        </Link>
                        <span className={styles.acctSlug}>{row.slug}</span>
                      </span>
                    </td>
                    <td data-label="Kind">
                      <span className={`${styles.chip} ${row.kind === 'coaches_portal' ? styles.chipCoach : styles.chipOrg}`}>
                        {KIND_LABEL[row.kind]}
                      </span>
                    </td>
                    <td data-label="Plan" className={styles.dim}>{row.planLabel}</td>
                    <td data-label="Free through">
                      {fmtAbsoluteDate(row.freeThrough)}
                      {/* ⚠ A row migration 279 never reached still carries the pre-2026-09-07
                          instant. Recognition tolerates it — the account IS in the cohort — but
                          this desk is the only surface anyone would ever notice it on. */}
                      {row.isLegacyExpiry && (
                        <span
                          className={styles.chipLegacy}
                          title="This comp still sits on the pre-2026-09-07 instant — the backfill has not reached this row. The account is still recognised as founding."
                        >
                          Legacy
                        </span>
                      )}
                    </td>
                    <td data-label="Card on file">
                      {card
                        ? <span className={styles.stacked}><b className={styles.yes}>{card}</b><span>{fmtAbsoluteDate(row.cardOnFileAt)}</span></span>
                        : <span className={styles.dash}>—</span>}
                    </td>
                    <td data-label={`${nextYearLabel} choice`}>
                      {row.nextSeasonPlanId
                        ? <span className={styles.stacked}><b>{row.nextSeasonPlanLabel}</b><span>{row.nextSeasonBillingCycle} · {fmtAbsoluteDate(row.nextSeasonChosenAt)}</span></span>
                        : <span className={styles.dash}>—</span>}
                    </td>
                    {/* NOT a page-view metric — the product keeps none. This is the most recent
                        sign-in across the account's owners, named for what it is. */}
                    <td data-label="Owner last seen" className={styles.dim}>{fmtSince(row.ownerLastSeenAt, 'Never')}</td>
                    <td data-label="Used it for" className={styles.dim}>{row.usageLabel}</td>
                    <td data-label="Billing contact" className={styles.dim}>{row.billingContact ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className={styles.footnote}>
        Card on file is recorded in the app when Stripe confirms it — this list never calls Stripe.
        {noCardOnly && ' These are the same accounts the "no card yet" reminder audience reaches, minus anyone who has opted out.'}
      </p>
    </div>
  );
}
