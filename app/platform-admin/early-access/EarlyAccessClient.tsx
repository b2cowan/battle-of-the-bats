'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clipboard, Mail, RefreshCw, Search, X } from 'lucide-react';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  EARLY_ACCESS_FEATURE_LABELS,
  EARLY_ACCESS_PLAN_LABELS,
  EARLY_ACCESS_STATUS_LABELS,
  EARLY_ACCESS_STATUSES,
  type EarlyAccessStatus,
} from '@/lib/early-access-admin';
import styles from './early-access.module.css';

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

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function labelList(values: string[], labels: Record<string, string>) {
  if (!values.length) return 'None selected';
  return values.map(value => labels[value] ?? value).join(', ');
}

function statusLabel(value: string) {
  return EARLY_ACCESS_STATUS_LABELS[value as EarlyAccessStatus] ?? value.replace(/_/g, ' ');
}

function buildQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  params.set('limit', '100');
  return params;
}

function applyTemplate(template: string, lead: Lead) {
  return template
    .replaceAll('{{name}}', lead.name.split(' ')[0] || lead.name)
    .replaceAll('{{organization}}', lead.organization_name || 'your organization');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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
    status: '',
    consent: '',
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<EarlyAccessStatus>('new');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftConvertedOrgId, setDraftConvertedOrgId] = useState('');
  const [draftFollowUpDueAt, setDraftFollowUpDueAt] = useState('');
  const [draftNextAction, setDraftNextAction] = useState('');
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

  const queryString = useMemo(() => buildQuery(filters).toString(), [filters]);

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
    setFilters(current => ({ ...current, [key]: value }));
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
    setFilters({ q: '', plan: '', feature: '', status: '', consent: '' });
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
    window.location.href = `/api/platform-admin/early-access/export?${queryString}&format=xlsx`;
  }

  function handleExportCSV() {
    window.location.href = `/api/platform-admin/early-access/export?${queryString}&format=csv`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Growth Pipeline</div>
          <h1 className={styles.title}>Early Access</h1>
        </div>
        <div className={styles.count}>{total} leads</div>
      </header>

      <section className={styles.summaryGrid} aria-label="Early access summary">
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Loaded</span>
          <strong>{leads.length}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>New</span>
          <strong>{summary.newLeads}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Pilot</span>
          <strong>{summary.pilotCandidates}</strong>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Converted</span>
          <strong>{summary.converted}</strong>
          <span className={styles.metricHint}>{conversionRate}% rate</span>
        </div>
        <div className={summary.followUpsDue > 0 ? `${styles.metric} ${styles.metricWarn}` : styles.metric}>
          <span className={styles.metricLabel}>Follow-up Due</span>
          <strong>{summary.followUpsDue}</strong>
        </div>
      </section>

      <section className={styles.conversionGrid} aria-label="Conversion breakdown">
        <div className={styles.breakdownPanel}>
          <div className={styles.notesLabel}>Conversions By Plan Interest</div>
          {conversionByPlan.length === 0 ? (
            <p className={styles.muted}>No leads loaded.</p>
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
        <div className={styles.breakdownPanel}>
          <div className={styles.notesLabel}>Conversions By Feature Interest</div>
          {conversionByFeature.length === 0 ? (
            <p className={styles.muted}>No leads loaded.</p>
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
      </section>

      <div className={styles.filterBar}>
        <label className={styles.searchBox}>
          <Search size={14} />
          <input
            value={filters.q}
            onChange={event => updateFilter('q', event.target.value)}
            placeholder="Search contacts, orgs, notes..."
          />
        </label>
        <select value={filters.plan} onChange={event => updateFilter('plan', event.target.value)}>
          <option value="">All plans</option>
          {Object.entries(EARLY_ACCESS_PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.feature} onChange={event => updateFilter('feature', event.target.value)}>
          <option value="">All features</option>
          {Object.entries(EARLY_ACCESS_FEATURE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          {EARLY_ACCESS_STATUSES.map(status => (
            <option key={status} value={status}>{EARLY_ACCESS_STATUS_LABELS[status]}</option>
          ))}
        </select>
        <select value={filters.consent} onChange={event => updateFilter('consent', event.target.value)}>
          <option value="">Any consent</option>
          <option value="yes">Consented</option>
          <option value="no">No updates</option>
        </select>
        <button className={styles.iconButton} onClick={resetFilters} title="Clear filters" type="button">
          <X size={14} />
          Clear
        </button>
        <button className={styles.iconButton} onClick={copyConsentedEmails} title="Copy consented emails" type="button">
          <Clipboard size={14} />
          Copy emails
        </button>
        <ExportMenu
          formats={['xlsx', 'csv']}
          onExportXLSX={handleExportXLSX}
          onExportCSV={handleExportCSV}
          label="Export"
        />
      </div>

      {(message || error) && (
        <div className={error ? styles.error : styles.message}>
          {error || message}
        </div>
      )}

      <div className={styles.workspace}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Organization</th>
                <th>Contact</th>
                <th>Interest</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>Loading early-access leads...</td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>No early-access leads match these filters.</td>
                </tr>
              )}
              {!loading && leads.map(lead => (
                <tr key={lead.id} className={selectedId === lead.id ? styles.selectedRow : undefined}>
                  <td>
                    <button className={styles.orgButton} onClick={() => openLead(lead)} type="button">
                      {lead.organization_name || 'No organization'}
                    </button>
                    <div className={styles.muted}>{lead.sports || 'No sport/program listed'}</div>
                  </td>
                  <td>
                    <div className={styles.primaryText}>{lead.name}</div>
                    <div className={styles.muted}>{lead.email}</div>
                  </td>
                  <td>
                    <div>{labelList(lead.plan_interest, EARLY_ACCESS_PLAN_LABELS)}</div>
                    <div className={styles.muted}>{labelList(lead.features_interested, EARLY_ACCESS_FEATURE_LABELS)}</div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status_${lead.internal_status}`] ?? ''}`}>
                      {statusLabel(lead.internal_status)}
                    </span>
                    {(lead.converted_org_id || lead.converted_at) && (
                      <div className={styles.convertedMeta}>
                        Converted {formatDate(lead.converted_at)}
                      </div>
                    )}
                    {lead.follow_up_due_at && (
                      <div className={lead.follow_up_due_at <= todayDate() ? styles.followUpDue : styles.muted}>
                        Follow up {formatDate(lead.follow_up_due_at)}
                      </div>
                    )}
                    {!lead.release_notifications_consent && (
                      <div className={styles.noConsent}>No release updates</div>
                    )}
                  </td>
                  <td className={styles.dateCell}>
                    {formatDate(lead.created_at)}
                    {lead.submission_count > 1 && (
                      <div className={styles.muted}>{lead.submission_count} submissions</div>
                    )}
                  </td>
                  <td>
                    <button className={styles.viewButton} onClick={() => openLead(lead)} type="button">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className={styles.detailPanel} aria-label="Lead detail">
          {!selectedLead && (
            <div className={styles.emptyDetail}>
              <Mail size={18} />
              <p>Select a lead to review details, update status, and copy outreach text.</p>
            </div>
          )}

          {selectedLead && (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.headerLabel}>Lead Detail</div>
                  <h2>{selectedLead.organization_name || selectedLead.name}</h2>
                </div>
                <button className={styles.closeButton} onClick={() => setSelectedId(null)} type="button" title="Close detail">
                  <X size={15} />
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
                            <Link href={`/platform-admin/orgs/${selectedLead.converted_org_id}`} className={styles.detailLink}>
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
                  <dd>{selectedLead.source_path || 'Unknown'}</dd>
                </div>
              </dl>

              <div className={styles.notesBlock}>
                <div className={styles.notesLabel}>What would make this useful?</div>
                <p>{selectedLead.notes || 'No notes submitted.'}</p>
              </div>

              <label className={styles.fieldLabel}>
                Status
                <select
                  value={draftStatus}
                  onChange={event => setDraftStatus(event.target.value as EarlyAccessStatus)}
                  disabled={!canManageGrowth}
                >
                  {EARLY_ACCESS_STATUSES.map(status => (
                    <option key={status} value={status}>{EARLY_ACCESS_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                Converted organization
                <select
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

              <label className={styles.fieldLabel}>
                Follow-up due
                <input
                  type="date"
                  value={draftFollowUpDueAt}
                  onChange={event => setDraftFollowUpDueAt(event.target.value)}
                  disabled={!canManageGrowth}
                />
              </label>

              <label className={styles.fieldLabel}>
                Next action
                <textarea
                  value={draftNextAction}
                  onChange={event => setDraftNextAction(event.target.value)}
                  rows={3}
                  placeholder="Call owner, send pilot invite, wait for launch email..."
                  disabled={!canManageGrowth}
                />
              </label>

              <label className={styles.fieldLabel}>
                Internal notes
                <textarea
                  value={draftNotes}
                  onChange={event => setDraftNotes(event.target.value)}
                  rows={6}
                  placeholder="Qualification notes, follow-up plan, launch fit..."
                  disabled={!canManageGrowth}
                />
              </label>

              <div className={styles.actionRow}>
                <button className={styles.primaryButton} onClick={() => saveLead()} disabled={saving || !canManageGrowth} type="button">
                  <Check size={14} />
                  Save
                </button>
                <button className={styles.iconButton} onClick={() => saveLead({ markConverted: true })} disabled={saving || !canManageGrowth} type="button">
                  <Check size={14} />
                  Mark converted
                </button>
                <button className={styles.iconButton} onClick={() => saveLead({ markContacted: true })} disabled={saving || !canManageGrowth} type="button">
                  <RefreshCw size={14} />
                  Mark contacted
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => copyText(selectedLead.email, 'Copied email.')}
                  type="button"
                >
                  <Clipboard size={14} />
                  Email
                </button>
              </div>

              <section className={styles.templates} aria-label="Outreach templates">
                <div className={styles.notesLabel}>Templates</div>
                <button
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.league, selectedLead), 'Copied League Plus template.')}
                  type="button"
                >
                  League Plus beta invite
                </button>
                <button
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.club, selectedLead), 'Copied Club update.')}
                  type="button"
                >
                  Club roadmap update
                </button>
                <button
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
