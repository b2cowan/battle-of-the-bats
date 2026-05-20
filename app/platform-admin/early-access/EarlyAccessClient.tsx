'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Download, Mail, RefreshCw, Search, X } from 'lucide-react';
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
};

type LeadResponse = {
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
};

const TEMPLATE_COPY = {
  league: `Subject: FieldLogicHQ League early access\n\nHi {{name}},\n\nThanks for joining the League early-access list. We are refining the house league workflow now and I would love to learn more about how {{organization}} manages registration, scheduling, communications, and public updates today.\n\nWould you be open to a short feedback call?`,
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

export default function EarlyAccessClient() {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedLead = useMemo(
    () => leads.find(lead => lead.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const queryString = useMemo(() => buildQuery(filters).toString(), [filters]);

  const summary = useMemo(() => ({
    newLeads: leads.filter(lead => lead.internal_status === 'new').length,
    pilotCandidates: leads.filter(lead => lead.internal_status === 'pilot_candidate').length,
    consented: leads.filter(lead => lead.release_notifications_consent).length,
  }), [leads]);

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

  async function saveLead(markContacted = false) {
    if (!selectedLead) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/platform-admin/early-access/${selectedLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalStatus: draftStatus,
          internalNotes: draftNotes,
          markContacted,
        }),
      });
      if (!response.ok) throw new Error('Unable to save lead');
      const payload = await response.json() as { lead: Lead };
      setLeads(current => current.map(lead => lead.id === payload.lead.id ? payload.lead : lead));
      setMessage(markContacted ? 'Marked contacted.' : 'Lead saved.');
      window.setTimeout(() => setMessage(''), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lead');
    } finally {
      setSaving(false);
    }
  }

  function openExport() {
    window.location.href = `/api/platform-admin/early-access/export?${queryString}`;
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
          <span className={styles.metricLabel}>Consented</span>
          <strong>{summary.consented}</strong>
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
        <button className={styles.iconButton} onClick={openExport} title="Export filtered CSV" type="button">
          <Download size={14} />
          CSV
        </button>
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
                <select value={draftStatus} onChange={event => setDraftStatus(event.target.value as EarlyAccessStatus)}>
                  {EARLY_ACCESS_STATUSES.map(status => (
                    <option key={status} value={status}>{EARLY_ACCESS_STATUS_LABELS[status]}</option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                Internal notes
                <textarea
                  value={draftNotes}
                  onChange={event => setDraftNotes(event.target.value)}
                  rows={6}
                  placeholder="Qualification notes, follow-up plan, launch fit..."
                />
              </label>

              <div className={styles.actionRow}>
                <button className={styles.primaryButton} onClick={() => saveLead(false)} disabled={saving} type="button">
                  <Check size={14} />
                  Save
                </button>
                <button className={styles.iconButton} onClick={() => saveLead(true)} disabled={saving} type="button">
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
                  onClick={() => copyText(applyTemplate(TEMPLATE_COPY.league, selectedLead), 'Copied League template.')}
                  type="button"
                >
                  League beta invite
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
