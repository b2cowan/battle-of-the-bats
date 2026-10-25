'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clipboard, Mail, RefreshCw, X } from 'lucide-react';
import ExportMenu from '@/components/admin/ExportMenu';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import {
  EARLY_ACCESS_FEATURE_LABELS,
  EARLY_ACCESS_PLAN_LABELS,
  EARLY_ACCESS_STATUS_LABELS,
  EARLY_ACCESS_STATUSES,
  type EarlyAccessStatus,
} from '@/lib/early-access-admin';
import { fmtAbsoluteDate } from '@/lib/format-date';
import kit from '../console.module.css';
import styles from './early-access.module.css';
import { tournamentToday } from '@/lib/timezone';
import DateInput from '@/components/shared/DateInput';

type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  last_submitted_at: string;
  submission_count: number;
  status: string;
  internal_status: EarlyAccessStatus | string;
  internal_notes: string | null;
  name: string;
  email: string;
  organization_name: string | null;
  role: string | null;
  sports: string | null;
  plan_interest: string[];
  features_interested: string[];
  notes: string | null;
  source_path: string | null;
  release_notifications_consent: boolean;
  last_contacted_at: string | null;
  last_contacted_by: string | null;
  converted_org_id: string | null;
  converted_at: string | null;
  follow_up_due_at: string | null;
  next_action: string | null;
};

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
  planId: string;
};

type Props = {
  organizations: OrganizationOption[];
  canManageGrowth: boolean;
};

type LeadResponse = {
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
};

const TEMPLATE_COPY = {
  league: `Subject: FieldLogicHQ League Plus early access\n\nHi {{name}},\n\nThanks for joining the League Plus early-access list. We are refining the house league workflow now and I would love to learn more about how {{organization}} manages registration, scheduling, communications, and public updates today.\n\nWould you be open to a short feedback call?`,
  club: `Subject: FieldLogicHQ Club roadmap update\n\nHi {{name}},\n\nThanks for your interest in the Club tier. We are shaping the combined tournament, league, public site, accounting, and team workflows now, and your notes are helpful as we decide what should launch first.\n\nI will send updates as the release gets closer.`,
  feedback: `Subject: Quick FieldLogicHQ feedback call\n\nHi {{name}},\n\nI saw your early-access request for {{organization}} and wanted to ask a few questions about what would make FieldLogicHQ useful for your program.\n\nWould a 20-minute call work sometime next week?`,
};

const formatDate = (value: string | null) => fmtAbsoluteDate(value, 'Never');

function labelList(values: string[], labels: Record<string, string>) {
  if (!values.length) return 'None selected';
  return values.map(value => labels[value] ?? value).join(', ');
}

function statusLabel(value: string) {
  return EARLY_ACCESS_STATUS_LABELS[value as EarlyAccessStatus] ?? value.replace(/_/g, ' ');
}

// New / qualified wear the plain chip; the rest of the pipeline reads by its verdict.
function statusChip(value: string) {
  if (value === 'pilot_candidate' || value === 'waiting_for_launch') return kit.chipInfo;
  if (value === 'contacted' || value === 'converted') return kit.chipOk;
  if (value === 'not_a_fit' || value === 'do_not_contact') return kit.chipBad;
  if (value === 'new' || value === 'qualified') return '';
  return kit.chipQuiet;
}

const PAGE_SIZE = 100;

function buildQuery(filters: Record<string, string>, offset = 0) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set('limit', String(PAGE_SIZE));
  if (offset > 0) params.set('offset', String(offset));
  return params;
}

function applyTemplate(template: string, lead: Lead) {
  return template
    .replaceAll('{{name}}', lead.name.split(' ')[0] || lead.name)
    .replaceAll('{{organization}}', lead.organization_name || 'your organization');
}

function todayDate() {
  return tournamentToday();
}

function conversionBreakdown(
  leads: Lead[],
  key: 'plan_interest' | 'features_interested',
  labels: Record<string, string>,
) {
  const rows = new Map<string, { label: string; total: number; converted: number }>();
  for (const lead of leads) {
    const values = lead[key].length ? lead[key] : ['none'];
    for (const value of values) {
      const current = rows.get(value) ?? { label: labels[value] ?? value, total: 0, converted: 0 };
      current.total += 1;
      if (lead.converted_org_id || lead.converted_at) current.converted += 1;
      rows.set(value, current);
    }
  }
  return [...rows.values()]
    .sort((a, b) => b.converted - a.converted || b.total - a.total)
    .slice(0, 5)
    .map(row => ({
      ...row,
      rate: row.total > 0 ? Math.round((row.converted / row.total) * 100) : 0,
    }));
}

export default function EarlyAccessClient({ organizations, canManageGrowth }: Props) {
  const [filters, setFilters] = useState({
    q: '',
    plan: '',
    feature: '',
    // Default to the actionable queue (New) on first load; "All statuses" clears it.
    status: 'new',
    consent: '',
    dateFrom: '',
    dateTo: '',
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<EarlyAccessStatus>('new');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftConvertedOrgId, setDraftConvertedOrgId] = useState('');
  const [draftFollowUpDueAt, setDraftFollowUpDueAt] = useState('');
  const [draftNextAction, setDraftNextAction] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedLead = useMemo(
    () => leads.find(lead => lead.id === selectedId) ?? null,
    [leads, selectedId],
  );
  const organizationById = useMemo(
    () => new Map(organizations.map(org => [org.id, org])),
    [organizations],
  );

  const queryString = useMemo(() => buildQuery(filters, offset).toString(), [filters, offset]);
  // Export should reflect the active filters but not the page offset (full filtered set).
  const exportQueryString = useMemo(() => buildQuery(filters).toString(), [filters]);

  const summary = useMemo(() => ({
    newLeads: leads.filter(lead => lead.internal_status === 'new').length,
    pilotCandidates: leads.filter(lead => lead.internal_status === 'pilot_candidate').length,
    consented: leads.filter(lead => lead.release_notifications_consent).length,
    converted: leads.filter(lead => lead.converted_org_id || lead.converted_at).length,
    followUpsDue: leads.filter(lead => lead.follow_up_due_at && lead.follow_up_due_at <= todayDate()).length,
  }), [leads]);
  const conversionRate = leads.length > 0 ? Math.round((summary.converted / leads.length) * 100) : 0;
  const conversionByPlan = useMemo(
    () => conversionBreakdown(leads, 'plan_interest', EARLY_ACCESS_PLAN_LABELS),
    [leads],
  );
  const conversionByFeature = useMemo(
    () => conversionBreakdown(leads, 'features_interested', EARLY_ACCESS_FEATURE_LABELS),
    [leads],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadLeads() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/platform-admin/early-access?${queryString}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load leads');
        const payload = await response.json() as LeadResponse;
        if (cancelled) return;
        setLeads(payload.leads);
        setTotal(payload.total);
        setSelectedId(current => current && !payload.leads.some(lead => lead.id === current) ? null : current);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load leads');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLeads();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  function updateFilter(key: keyof typeof filters, value: string) {
    setOffset(0); // any filter change returns to the first page
    setFilters(current => ({ ...current, [key]: value }));
  }

  function applyDatePreset(preset: string) {
    setDateRangePreset(preset);
    setOffset(0);
    if (preset === '' ) {
      setFilters(current => ({ ...current, dateFrom: '', dateTo: '' }));
    } else if (preset === 'custom') {
      // Reveal the custom inputs; keep whatever is already set.
    } else {
      const days = Number(preset);
      const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      setFilters(current => ({ ...current, dateFrom: from, dateTo: '' }));
    }
  }

  function openLead(lead: Lead) {
    const nextStatus = EARLY_ACCESS_STATUSES.includes(lead.internal_status as EarlyAccessStatus)
      ? lead.internal_status as EarlyAccessStatus
      : 'new';
    setSelectedId(lead.id);
    setDraftStatus(nextStatus);
    setDraftNotes(lead.internal_notes ?? '');
    setDraftConvertedOrgId(lead.converted_org_id ?? '');
    setDraftFollowUpDueAt(lead.follow_up_due_at ?? '');
    setDraftNextAction(lead.next_action ?? '');
  }

  function resetFilters() {
    setOffset(0);
    setDateRangePreset('');
    setFilters({ q: '', plan: '', feature: '', status: '', consent: '', dateFrom: '', dateTo: '' });
  }

  async function copyText(text: string, success: string) {
    await navigator.clipboard.writeText(text);
    setMessage(success);
    window.setTimeout(() => setMessage(''), 2400);
  }

  async function copyConsentedEmails() {
    const emails = leads
      .filter(lead => lead.release_notifications_consent)
      .map(lead => lead.email)
      .join(', ');
    if (!emails) {
      setMessage('No consented emails in this view.');
      return;
    }
    await copyText(emails, 'Copied consented emails.');
  }

  async function saveLead(options: { markContacted?: boolean; markConverted?: boolean } = {}) {
    if (!selectedLead) return;
    if (!canManageGrowth) {
      setError('Your platform role can view this lead but cannot update the growth pipeline.');
      return;
    }
    if (options.markConverted && !draftConvertedOrgId) {
      setError('Select the converted organization first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const nextStatus = options.markConverted ? 'converted' : draftStatus;
      const response = await fetch(`/api/platform-admin/early-access/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalStatus: nextStatus,
          internalNotes: draftNotes,
          markContacted: options.markContacted,
          convertedOrgId: draftConvertedOrgId || null,
          followUpDueAt: draftFollowUpDueAt || null,
          nextAction: draftNextAction,
        }),
      });
      if (!response.ok) throw new Error('Unable to save lead');
      const payload = await response.json() as { lead: Lead };
      setLeads(current => current.map(lead => lead.id === payload.lead.id ? payload.lead : lead));
      setDraftStatus(payload.lead.internal_status as EarlyAccessStatus);
      setDraftConvertedOrgId(payload.lead.converted_org_id ?? '');
      setDraftFollowUpDueAt(payload.lead.follow_up_due_at ?? '');
      setDraftNextAction(payload.lead.next_action ?? '');
      setMessage(options.markConverted ? 'Lead marked converted.' : options.markContacted ? 'Marked contacted.' : 'Lead saved.');
      window.setTimeout(() => setMessage(''), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lead');
    } finally {
      setSaving(false);
    }
  }

  function handleExportXLSX() {
    window.location.href = `/api/platform-admin/early-access/export?${exportQueryString}&format=xlsx`;
  }

  function handleExportCSV() {
    window.location.href = `/api/platform-admin/early-access/export?${exportQueryString}&format=csv`;
  }

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Leads" />

      <section className={kit.band} aria-label="Early access summary">
        <div className={kit.bandCell} title="Counts below reflect the leads currently in view (this page), not the full pipeline total shown in the toolbar.">
          <span className={kit.bandLabel}>In view</span>
          <strong className={kit.bandValue}>{leads.length}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>New</span>
          <strong className={kit.bandValue}>{summary.newLeads}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Pilot</span>
          <strong className={kit.bandValue}>{summary.pilotCandidates}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Converted</span>
          <strong className={kit.bandValue}>{summary.converted}</strong>
          <span className={kit.bandNote}>{conversionRate}% rate</span>
        </div>
        <div className={`${kit.bandCell} ${summary.followUpsDue > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>Follow-up due</span>
          <strong className={kit.bandValue}>{summary.followUpsDue}</strong>
        </div>
      </section>

      <section className={kit.two} aria-label="Conversion breakdown">
        <div className={kit.section}>
          <h2 className={kit.sectionTitle}>Conversions by plan interest</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            {conversionByPlan.length === 0 ? (
              <p className={kit.caption}>No leads loaded.</p>
            ) : (
              <div className={styles.conversionList}>
                {conversionByPlan.map(row => (
                  <div key={row.label} className={styles.conversionItem}>
                    <span>{row.label}</span>
                    <strong>{row.converted}/{row.total}</strong>
                    <em>{row.rate}%</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={kit.section}>
          <h2 className={kit.sectionTitle}>Conversions by feature interest</h2>
          <div className={`${kit.card} ${kit.cardPad}`}>
            {conversionByFeature.length === 0 ? (
              <p className={kit.caption}>No leads loaded.</p>
            ) : (
              <div className={styles.conversionList}>
                {conversionByFeature.map(row => (
                  <div key={row.label} className={styles.conversionItem}>
                    <span>{row.label}</span>
                    <strong>{row.converted}/{row.total}</strong>
                    <em>{row.rate}%</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(message || error) && (
        <div className={`${kit.notice} ${error ? kit.noticeBad : kit.noticeGood}`} role="status">
          {error || message}
        </div>
      )}

      <div className={styles.workspace}>
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>{total} leads</span>
            <span className={kit.toolbarEnd}>
              <button className="btn btn-secondary btn-sm" onClick={copyConsentedEmails} title="Copy consented emails" type="button">
                <Clipboard size={14} aria-hidden />
                Copy emails
              </button>
              <ExportMenu
                formats={['xlsx', 'csv']}
                onExportXLSX={handleExportXLSX}
                onExportCSV={handleExportCSV}
                label="Export"
              />
            </span>
          </div>
          <div className={kit.toolbar}>
            <input
              type="search"
              className={kit.search}
              aria-label="Search leads"
              value={filters.q}
              onChange={event => updateFilter('q', event.target.value)}
              placeholder="Search contacts, orgs, notes..."
            />
            <select className={kit.select} aria-label="Plan" value={filters.plan} onChange={event => updateFilter('plan', event.target.value)}>
              <option value="">All plans</option>
              {Object.entries(EARLY_ACCESS_PLAN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select className={kit.select} aria-label="Feature" value={filters.feature} onChange={event => updateFilter('feature', event.target.value)}>
              <option value="">All features</option>
              {Object.entries(EARLY_ACCESS_FEATURE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select className={kit.select} aria-label="Status" value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {EARLY_ACCESS_STATUSES.map(status => (
                <option key={status} value={status}>{EARLY_ACCESS_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select className={kit.select} aria-label="Consent" value={filters.consent} onChange={event => updateFilter('consent', event.target.value)}>
              <option value="">Any consent</option>
              <option value="yes">Consented</option>
              <option value="no">No updates</option>
            </select>
            <select className={kit.select} aria-label="Signup date" value={dateRangePreset} onChange={event => applyDatePreset(event.target.value)} title="Filter by signup date">
              <option value="">Any date</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom…</option>
            </select>
            {dateRangePreset === 'custom' && (
              <>
                <DateInput
                  className={kit.field}
                  inline
                  aria-label="From date"
                  value={filters.dateFrom}
                  max={filters.dateTo || undefined}
                  onChange={v => updateFilter('dateFrom', v)}
                  title="From date"
                />
                <DateInput
                  className={kit.field}
                  inline
                  aria-label="To date"
                  value={filters.dateTo}
                  min={filters.dateFrom || undefined}
                  rangeStart={filters.dateFrom || undefined}
                  onChange={v => updateFilter('dateTo', v)}
                  title="To date"
                />
              </>
            )}
            <button className={kit.door} onClick={resetFilters} title="Clear filters" type="button">
              Clear
            </button>
          </div>

          <div className={`${kit.tableWrap} table-cards`}>
            <table className={styles.leadTable}>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Contact</th>
                  <th>Interest</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th aria-label="View"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className={kit.empty}>Loading early-access leads...</td>
                  </tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={6} className={kit.empty}>No early-access leads match these filters.</td>
                  </tr>
                )}
                {!loading && leads.map(lead => (
                  <tr key={lead.id} className={`${kit.comfortable} ${styles.leadRow} ${selectedId === lead.id ? styles.selectedRow : ''}`}>
                    <td className="table-cards-title">
                      <div>
                        <button className={styles.orgButton} onClick={() => openLead(lead)} type="button">
                          {lead.organization_name || 'No organization'}
                        </button>
                        <span className={kit.sub}>{lead.sports || 'No sport/program listed'}</span>
                      </div>
                    </td>
                    <td data-label="Contact">
                      <div>
                        <span className={styles.primaryText}>{lead.name}</span>
                        <span className={`${kit.sub} ${styles.breakAny}`}>{lead.email}</span>
                      </div>
                    </td>
                    <td data-label="Interest">
                      <div>
                        {labelList(lead.plan_interest, EARLY_ACCESS_PLAN_LABELS)}
                        <span className={kit.sub}>{labelList(lead.features_interested, EARLY_ACCESS_FEATURE_LABELS)}</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <div>
                        <span className={`${kit.chip} ${statusChip(lead.internal_status)}`}>
                          {statusLabel(lead.internal_status)}
                        </span>
                        {(lead.converted_org_id || lead.converted_at) && (
                          <span className={`${kit.sub} ${styles.metaOk}`}>
                            Converted {formatDate(lead.converted_at)}
                          </span>
                        )}
                        {lead.follow_up_due_at && (
                          <span className={`${kit.sub} ${lead.follow_up_due_at <= todayDate() ? styles.metaWarn : ''}`}>
                            Follow up {formatDate(lead.follow_up_due_at)}
                          </span>
                        )}
                        {!lead.release_notifications_consent && (
                          <span className={`${kit.sub} ${styles.metaBad}`}>No release updates</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Submitted" className={kit.nowrap}>
                      <div>
                        {formatDate(lead.created_at)}
                        {lead.submission_count > 1 && (
                          <span className={kit.sub}>{lead.submission_count} submissions</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openLead(lead)} type="button">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className={styles.pagination}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0 || loading}
                type="button"
              >
                Previous
              </button>
              <span className={kit.countQuiet}>
                {leads.length > 0 ? `${offset + 1}–${offset + leads.length}` : '0'} of {total}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setOffset(o => o + PAGE_SIZE)}
                disabled={offset + leads.length >= total || loading}
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <aside className={`${kit.card} ${kit.cardPad} ${styles.detailPanel}`} aria-label="Lead detail">
          {!selectedLead && (
            <div className={styles.emptyDetail}>
              <Mail size={18} aria-hidden />
              <p>Select a lead to review details, update status, and copy outreach text.</p>
            </div>
          )}

          {selectedLead && (
            <>
              <div className={styles.detailHeader}>
                <h2 className={kit.sectionTitle}>{selectedLead.organization_name || selectedLead.name}</h2>
                <button className={styles.closeButton} onClick={() => setSelectedId(null)} type="button" title="Close detail" aria-label="Close detail">
                  <X size={16} aria-hidden />
                </button>
              </div>

              <dl className={styles.detailList}>
                <div>
                  <dt>Contact</dt>
                  <dd>{selectedLead.name} ({selectedLead.email})</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{selectedLead.role || 'Not provided'}</dd>
                </div>
                <div>
                  <dt>Plans</dt>
                  <dd>{labelList(selectedLead.plan_interest, EARLY_ACCESS_PLAN_LABELS)}</dd>
                </div>
                <div>
                  <dt>Features</dt>
                  <dd>{labelList(selectedLead.features_interested, EARLY_ACCESS_FEATURE_LABELS)}</dd>
                </div>
                <div>
                  <dt>Last contacted</dt>
                  <dd>{formatDate(selectedLead.last_contacted_at)}</dd>
                </div>
                <div>
                  <dt>Converted</dt>
                  <dd>
                    {selectedLead.converted_org_id || selectedLead.converted_at ? (
                      <>
                        {formatDate(selectedLead.converted_at)}
                        {selectedLead.converted_org_id && organizationById.get(selectedLead.converted_org_id) && (
                          <>
                            {' '}
                            <Link href={`/platform-admin/orgs/${selectedLead.converted_org_id}`} className={kit.nameLink}>
                              {organizationById.get(selectedLead.converted_org_id)!.name}
                            </Link>
                          </>
                        )}
                      </>
                    ) : 'Not converted'}
                  </dd>
                </div>
                <div>
                  <dt>Next follow-up</dt>
                  <dd>{selectedLead.follow_up_due_at ? formatDate(selectedLead.follow_up_due_at) : 'Not set'}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedLead.source_path ? <span className={kit.code}>{selectedLead.source_path}</span> : 'Unknown'}</dd>
                </div>
              </dl>

              <div className={styles.notesBlock}>
                <div className={kit.label}>What would make this useful?</div>
                <p>{selectedLead.notes || 'No notes submitted.'}</p>
              </div>

              <label className={kit.fieldGroup}>
                <span className={kit.label}>Status</span>
                <select
                  className={`${kit.select} ${kit.wide} ${styles.dimDisabled}`}
                  value={draftStatus}
                  onChange={event => setDraftStatus(event.target.value as EarlyAccessStatus)}
                  disabled={!canManageGrowth}
                >
                  {EARLY_ACCESS_STATUSES.map(status => (
                    <option key={status} value={status}>{EARLY_ACCESS_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>

              <label className={kit.fieldGroup}>
                <span className={kit.label}>Converted organization</span>
                <select
                  className={`${kit.select} ${kit.wide} ${styles.dimDisabled}`}
                  value={draftConvertedOrgId}
                  onChange={event => setDraftConvertedOrgId(event.target.value)}
                  disabled={!canManageGrowth}
                >
                  <option value="">Not linked</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name} /{org.slug}
                    </option>
                  ))}
                </select>
              </label>

              <label className={kit.fieldGroup}>
                <span className={kit.label}>Follow-up due</span>
                <DateInput
                  className={`${kit.field} ${kit.wide} ${styles.dimDisabled}`}
                  value={draftFollowUpDueAt}
                  onChange={v => setDraftFollowUpDueAt(v)}
                  disabled={!canManageGrowth}
                />
              </label>

              <label className={kit.fieldGroup}>
                <span className={kit.label}>Next action</span>
                <textarea
                  className={`${kit.textarea} ${kit.wide} ${styles.dimDisabled}`}
                  value={draftNextAction}
                  onChange={event => setDraftNextAction(event.target.value)}
                  rows={3}
                  placeholder="Call owner, send pilot invite, wait for launch email..."
                  disabled={!canManageGrowth}
                />
              </label>

              <label className={kit.fieldGroup}>
                <span className={kit.label}>Internal notes</span>
                <textarea
                  className={`${kit.textarea} ${kit.wide} ${styles.dimDisabled}`}
                  value={draftNotes}
                  onChange={event => setDraftNotes(event.target.value)}
                  rows={6}
                  placeholder="Qualification notes, follow-up plan, launch fit..."
                  disabled={!canManageGrowth}
                />
              </label>

              <div className={kit.formActions}>
                <button className="btn btn-primary btn-sm" onClick={() => saveLead()} disabled={saving || !canManageGrowth} type="button">
                  <Check size={14} aria-hidden />
                  Save
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => saveLead({ markConverted: true })} disabled={saving || !canManageGrowth} type="button">
                  <Check size={14} aria-hidden />
                  Mark converted
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => saveLead({ markContacted: true })} disabled={saving || !canManageGrowth} type="button">
                  <RefreshCw size={14} aria-hidden />
                  Mark contacted
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyText(selectedLead.email, 'Copied email.')}
                  type="button"
                >
                  <Clipboard size={14} aria-hidden />
                  Email
                </button>
              </div>

              <section className={styles.templates} aria-label="Outreach templates">
                <div className={kit.label}>Templates</div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.league, selectedLead), 'Copied League Plus template.')}
                  type="button"
                >
                  League Plus beta invite
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.club, selectedLead), 'Copied Club update.')}
                  type="button"
                >
                  Club roadmap update
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.feedback, selectedLead), 'Copied feedback template.')}
                  type="button"
                >
                  Feedback call
                </button>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
