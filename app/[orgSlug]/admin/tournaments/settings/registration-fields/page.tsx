'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardList, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import { hasPlanFeature } from '@/lib/plan-features';
import type { TournamentRegistrationField, TournamentRegistrationFieldType } from '@/lib/types';
import styles from '../../branding/branding.module.css';

const FIELD_TYPES: Array<{ value: TournamentRegistrationFieldType; label: string }> = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'file', label: 'File upload' },
];

type DraftField = {
  label: string;
  fieldType: TournamentRegistrationFieldType;
  optionsText: string;
  required: boolean;
};

function emptyDraft(): DraftField {
  return { label: '', fieldType: 'short_text', optionsText: '', required: false };
}

function optionsTextToArray(value: string) {
  return value
    .split(/\r?\n|,/)
    .map(option => option.trim())
    .filter(Boolean);
}

function fieldToDraft(field: TournamentRegistrationField): DraftField {
  return {
    label: field.label,
    fieldType: field.fieldType,
    optionsText: field.options.join('\n'),
    required: field.required,
  };
}

export default function RegistrationFieldsSettingsPage() {
  const { currentOrg } = useOrg();
  usePageTitle('Registration Questions');
  const { currentTournament } = useTournament();
  const searchParams = useSearchParams();
  const fromRegistrations = searchParams.get('from') === 'registrations';
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings`;
  const backHref = fromRegistrations ? `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/registrations` : base;
  const backLabel = fromRegistrations ? 'Registrations' : 'Settings';
  const [fields, setFields] = useState<TournamentRegistrationField[]>([]);
  const [draft, setDraft] = useState<DraftField>(() => emptyDraft());
  const [editing, setEditing] = useState<Record<string, DraftField>>({});
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const hasPlus = currentOrg ? hasPlanFeature(currentOrg.planId, 'custom_registration_fields') : false;
  const tournamentId = currentTournament?.id;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const load = useCallback(async () => {
    if (!tournamentId || !hasPlus) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields${orgQuery}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to load registration questions.');
      setFields(data.fields ?? []);
      setEditing(Object.fromEntries((data.fields ?? []).map((field: TournamentRegistrationField) => [field.id, fieldToDraft(field)])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load registration questions.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, hasPlus, orgQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createField(e: React.FormEvent) {
    e.preventDefault();
    if (!tournamentId) return;
    setWorking('new');
    setMessage('');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: draft.label,
          fieldType: draft.fieldType,
          options: optionsTextToArray(draft.optionsText),
          required: draft.required,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to add question.');
      setDraft(emptyDraft());
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add question.');
    } finally {
      setWorking(null);
    }
  }

  async function saveField(field: TournamentRegistrationField) {
    if (!tournamentId) return;
    const next = editing[field.id];
    setWorking(field.id);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields/${encodeURIComponent(field.id)}${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: next.label,
          fieldType: next.fieldType,
          options: optionsTextToArray(next.optionsText),
          required: next.required,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to save question.');
      await load();
      setMessage('Registration question saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save question.');
    } finally {
      setWorking(null);
    }
  }

  async function archiveField(field: TournamentRegistrationField) {
    if (!tournamentId || !window.confirm(`Archive "${field.label}"? Existing answers stay attached to registrations.`)) return;
    setWorking(field.id);
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields/${encodeURIComponent(field.id)}${orgQuery}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Unable to archive question.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to archive question.');
    } finally {
      setWorking(null);
    }
  }

  async function moveField(index: number, direction: -1 | 1) {
    if (!tournamentId) return;
    const next = [...fields];
    const target = index + direction;
    if (!next[index] || !next[target]) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    setWorking('reorder');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', fields: next.map((field, sortOrder) => ({ id: field.id, sortOrder })) }),
      });
      if (!res.ok) throw new Error('Unable to reorder questions.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reorder questions.');
    } finally {
      setWorking(null);
    }
  }

  if (!tournamentId) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--white-40)', fontSize: '0.9rem' }}>Select a tournament from the sidebar to manage registration questions.</p>
      </div>
    );
  }

  if (!hasPlus) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <Link href={backHref} className={styles.backBtn}><ArrowLeft size={13} /> {backLabel}</Link>
        </div>
        <div className={styles.settingsTitleRow}>
          <div className={styles.headerIcon}><ClipboardList size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Registration Questions</h1>
            <p className={styles.pageSub}>Every registration already collects team name, coach, email, and division.</p>
          </div>
        </div>
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Lock size={14} style={{ color: 'var(--white-40)', flexShrink: 0 }} />
            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Custom questions</h2>
          </div>
          <p style={{ color: 'var(--white-60)', lineHeight: 1.6 }}>
            Add short text fields, dropdowns, file uploads, and more to gather tournament-specific details at registration.
            Available with{' '}
            <Link
              href={`/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`}
              style={{ color: 'var(--white-60)', textDecoration: 'underline' }}
            >
              Tournament Plus
            </Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link href={backHref} className={styles.backBtn}><ArrowLeft size={13} /> {backLabel}</Link>
      </div>

      <div className={styles.settingsTitleRow}>
        <div className={styles.headerIcon}><ClipboardList size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Registration Questions</h1>
          <p className={styles.pageSub}>{currentTournament?.name} - collect tournament-specific team details</p>
        </div>
      </div>

      {message && (
        <div className="alert" style={{ marginBottom: '1rem', color: 'var(--white-70)' }}>
          {message}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Active Questions</h2>
          <a href="#add-question-form" className="btn btn-outline btn-data"><Plus size={14} /> Add Question</a>
        </div>
        {loading ? (
          <p style={{ color: 'var(--white-40)' }}>Loading...</p>
        ) : fields.length === 0 ? (
          <p style={{ color: 'var(--white-40)' }}>No custom registration questions yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fields.map((field, index) => {
              const edit = editing[field.id] ?? fieldToDraft(field);
              return (
                <div key={field.id} className={styles.questionCard}>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Question</label>
                      <input className="form-input" value={edit.label} onChange={e => setEditing(prev => ({ ...prev, [field.id]: { ...edit, label: e.target.value } }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Type</label>
                      <select className="form-input" value={edit.fieldType} onChange={e => setEditing(prev => ({ ...prev, [field.id]: { ...edit, fieldType: e.target.value as TournamentRegistrationFieldType } }))}>
                        {FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {edit.fieldType === 'dropdown' && (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="form-label">Dropdown options</label>
                      <textarea className="form-textarea" rows={3} value={edit.optionsText} onChange={e => setEditing(prev => ({ ...prev, [field.id]: { ...edit, optionsText: e.target.value } }))} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--white-70)' }}>
                      <input type="checkbox" checked={edit.required} onChange={e => setEditing(prev => ({ ...prev, [field.id]: { ...edit, required: e.target.checked } }))} />{' '}
                      Required
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => moveField(index, -1)} disabled={index === 0 || working === 'reorder'} title="Move up"><ArrowUp size={14} /></button>
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1 || working === 'reorder'} title="Move down"><ArrowDown size={14} /></button>
                      <button type="button" className="btn btn-outline btn-data" onClick={() => saveField(field)} disabled={working === field.id}><Save size={14} /> Save</button>
                      <button type="button" className="btn btn-danger btn-data" onClick={() => archiveField(field)} disabled={working === field.id} title="Archive question"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form id="add-question-form" className={styles.card} onSubmit={createField}>
        <h2 className={styles.sectionTitle}>Add a Question</h2>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Question</label>
            <input className="form-input" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select className="form-input" value={draft.fieldType} onChange={e => setDraft(d => ({ ...d, fieldType: e.target.value as TournamentRegistrationFieldType }))}>
              {FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>
        </div>
        {draft.fieldType === 'dropdown' && (
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Dropdown options</label>
            <textarea className="form-textarea" rows={3} value={draft.optionsText} onChange={e => setDraft(d => ({ ...d, optionsText: e.target.value }))} placeholder="One option per line" required />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', color: 'var(--white-70)' }}>
          <input type="checkbox" checked={draft.required} onChange={e => setDraft(d => ({ ...d, required: e.target.checked }))} />{' '}
          Required on public registration
        </label>
        <div className={styles.formFooter}>
          <button type="submit" className="btn btn-lime btn-data" disabled={working === 'new'}>
            <Plus size={14} /> {working === 'new' ? 'Adding...' : 'Add Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
