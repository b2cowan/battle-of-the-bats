'use client';
import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, X, Check, ChevronUp, ChevronDown, Trophy } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import type { AgeGroup, Contact } from '@/lib/types';
import styles from './admin-page.module.css';

type ModalMode = 'add' | 'edit' | null;
type TieBreaker = NonNullable<AgeGroup['playoffConfig']>['tieBreakers'][number];
type AgeGroupFormPayload = {
  tournamentId: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
  order: number;
  contactId?: string;
  capacity?: number;
  isClosed: boolean;
  poolCount: number;
  poolNames?: string;
  requiresPoolSelection: boolean;
  playoffConfig: NonNullable<AgeGroup['playoffConfig']>;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  totalFeeAmount?: number | null;
  totalFeeDueDate?: string | null;
};

async function loadAgeGroupState(tournamentId?: string, orgSlug?: string) {
  if (!tournamentId) return { groups: [] as AgeGroup[], contacts: [] as Contact[] };
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const [groupsRes, contactsRes] = await Promise.all([
    fetch(`/api/admin/age-groups?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
    fetch(`/api/admin/contacts?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
  ]);
  const groups: AgeGroup[]  = groupsRes.ok   ? await groupsRes.json()   : [];
  const contacts: Contact[] = contactsRes.ok ? await contactsRes.json() : [];
  return { groups, contacts };
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function normalizeTieBreakers(values: string[]): TieBreaker[] {
  const allowed = new Set<TieBreaker>(['h2h', 'rd', 'rf', 'ra']);
  const normalized = values.filter((value): value is TieBreaker => allowed.has(value as TieBreaker));
  return normalized.length ? normalized : ['h2h', 'rd', 'rf', 'ra'];
}

export default function AgeGroupsPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const [groups, setGroups] = useState<AgeGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<AgeGroup | null>(null);
  const [form, setForm] = useState({
    name: '', minAge: '', maxAge: '', order: '', contactId: '',
    capacity: '', isClosed: false, poolCount: '0', poolNames: '',
    requiresPoolSelection: false, usePools: false,
    tieBreakers: ['h2h', 'rd', 'rf', 'ra'],
    depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refresh() {
    const next = await loadAgeGroupState(currentTournament?.id, currentOrg?.slug);
    setGroups(next.groups);
    setContacts(next.contacts);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await loadAgeGroupState(currentTournament?.id, currentOrg?.slug);
      if (cancelled) return;
      setGroups(next.groups);
      setContacts(next.contacts);
    }

    void load();
    return () => { cancelled = true; };
  }, [currentTournament?.id, currentOrg?.slug]);

  function openAdd() {
    setForm({
      name: '', minAge: '', maxAge: '', order: String(groups.length + 1),
      contactId: '', capacity: '', isClosed: false, poolCount: '0', poolNames: '',
      requiresPoolSelection: false, usePools: false,
      tieBreakers: ['h2h', 'rd', 'rf', 'ra'],
      depositAmount: '', depositDueDate: '', totalFeeAmount: '', totalFeeDueDate: '',
    });
    setEditing(null);
    setModal('add');
  }

  function openEdit(g: AgeGroup) {
    setForm({
      name: g.name,
      minAge: g.minAge === null || g.minAge === undefined ? '' : String(g.minAge),
      maxAge: g.maxAge === null || g.maxAge === undefined ? '' : String(g.maxAge),
      order: String(g.order), contactId: g.contactId || '',
      capacity: g.capacity ? String(g.capacity) : '', isClosed: !!g.isClosed,
      poolCount: String(g.poolCount || 0), poolNames: g.poolNames || '',
      requiresPoolSelection: !!g.requiresPoolSelection,
      usePools: (g.poolCount || 0) >= 2,
      tieBreakers: g.playoffConfig?.tieBreakers || ['h2h', 'rd', 'rf', 'ra'],
      depositAmount: g.depositAmount != null ? String(g.depositAmount) : '',
      depositDueDate: g.depositDueDate ?? '',
      totalFeeAmount: g.totalFeeAmount != null ? String(g.totalFeeAmount) : '',
      totalFeeDueDate: g.totalFeeDueDate ?? '',
    });
    setEditing(g);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const minAge = form.minAge.trim() ? Number(form.minAge) : null;
    const maxAge = form.maxAge.trim() ? Number(form.maxAge) : null;
    if (minAge !== null && (!Number.isFinite(minAge) || minAge < 0)) {
      alert('Age limits must be positive numbers, or left blank for an open-ended range.');
      return;
    }
    if (maxAge !== null && (!Number.isFinite(maxAge) || maxAge < 0)) {
      alert('Age limits must be positive numbers, or left blank for an open-ended range.');
      return;
    }
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      alert('Minimum age cannot be greater than maximum age.');
      return;
    }
    const data: AgeGroupFormPayload = {
      tournamentId: currentTournament.id,
      name: form.name.trim(),
      minAge,
      maxAge,
      order: Number(form.order),
      contactId: form.contactId || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      isClosed: form.isClosed,
      poolCount: Number(form.poolCount),
      poolNames: form.poolNames.trim() || undefined,
      requiresPoolSelection: form.requiresPoolSelection,
      playoffConfig: {
        ...(editing?.playoffConfig || { type: 'single', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 4 }),
        tieBreakers: normalizeTieBreakers(form.tieBreakers)
      },
      depositAmount:  form.depositAmount  ? Number(form.depositAmount)  : null,
      depositDueDate: form.depositDueDate || null,
      totalFeeAmount: form.totalFeeAmount ? Number(form.totalFeeAmount) : null,
      totalFeeDueDate: form.totalFeeDueDate || null,
    };

    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/age-groups${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: modal === 'add' ? 'save' : 'update',
          id: editing?.id,
          data 
        })
      });
      const resData = await res.json() as { error?: string };
      if (!res.ok) throw new Error(resData.error || 'Failed to save');
      
      setModal(null);
      refresh();
    } catch (err: unknown) {
      alert('Error saving: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/age-groups${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: deleteId })
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteId(null); 
      refresh();
    } catch (err: unknown) {
      alert('Error deleting: ' + getErrorMessage(err, 'Unknown error'));
    }
  }

  const breakerLabels: Record<string, string> = {
    h2h: 'Head-to-Head',
    rd: 'Run Diff',
    rf: 'Runs For',
    ra: 'Runs Against'
  };

  function moveBreaker(index: number, direction: 'up' | 'down') {
    const newBreakers = [...form.tieBreakers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBreakers.length) return;
    
    const temp = newBreakers[index];
    newBreakers[index] = newBreakers[targetIndex];
    newBreakers[targetIndex] = temp;
    setForm(f => ({ ...f, tieBreakers: newBreakers }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Tag size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Divisions</h1>
            <p className={styles.pageSub}>Manage tournament divisions and registration groups</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd} id="age-group-add-btn" disabled={!currentTournament}>
          <Plus size={16} /> Add Division
        </button>
      </div>

      <div className={`table-wrap ${styles.responsiveTable}`}>
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Pools</th>
              <th>Min Age</th>
              <th>Max Age</th>
              <th>Order</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyTableCell}>No divisions yet. Add one to get started.</td></tr>
            ) : groups.map(g => (
              <tr key={g.id}>
                <td data-label="Division"><span className="badge badge-primary" style={{ fontSize: '0.875rem' }}>{g.name}</span></td>
                <td data-label="Pools">
                  {(g.poolCount || 0) >= 2 && g.pools && g.pools.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {g.pools.map(p => (
                        <span key={p.id} className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'none' }}>
                          {p.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--white-20)', fontSize: '0.75rem' }}>No pools</span>
                  )}
                </td>
                <td data-label="Min Age">{g.minAge ?? 'Any'}</td>
                <td data-label="Max Age">{g.maxAge ?? 'Any'}</td>
                <td data-label="Order">{g.order}</td>
                <td data-label="Capacity">{g.capacity || 'No limit'}</td>
                <td data-label="Status">
                  {g.isClosed ? <span className="badge badge-danger">Closed</span> : <span className="badge badge-success">Open</span>}
                </td>
                <td data-label="Actions">
                  <div className={styles.mobileActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)} id={`edit-age-group-${g.id}`}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(g.id)} id={`delete-age-group-${g.id}`}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Division' : 'Edit Division'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division Name *</label>
                  <input className="form-input" placeholder="e.g. U13" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order *</label>
                  <input className="form-input" type="number" min="1" value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Division Contact (Optional)</label>
                <select className="form-select" value={form.contactId} onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))}>
                  <option value="">Default Admin Email</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
                <p className="form-help" style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  If selected, new team registration notifications for this division will be sent to this contact instead of the default admin email.
                </p>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Age</label>
                  <input className="form-input" type="number" value={form.minAge}
                    onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} placeholder="Blank for no minimum" />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Age</label>
                  <input className="form-input" type="number" value={form.maxAge}
                    onChange={e => setForm(f => ({ ...f, maxAge: e.target.value }))} placeholder="Blank for no maximum" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem', background: 'var(--white-5)', padding: '1rem', borderRadius: '2px', border: '1px solid var(--border-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.usePools ? '1rem' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.usePools} onChange={e => setForm(f => ({ ...f, usePools: e.target.checked, poolCount: e.target.checked ? (Number(f.poolCount) < 2 ? '2' : f.poolCount) : '0' }))} />
                    <span style={{ fontWeight: 600 }}>Enable Pools for this Division</span>
                  </label>
                  
                  {form.usePools && (
                    <div className="subCheck" title="When enabled, registrants choose their own pool on the signup form. When disabled, you assign pools manually from the Teams page.">
                      <label style={{ fontSize: '0.7rem', color: 'var(--white-30)', textTransform: 'uppercase', fontWeight: 800 }}>Registrant picks pool:</label>
                      <input type="checkbox" checked={form.requiresPoolSelection} onChange={e => setForm(f => ({ ...f, requiresPoolSelection: e.target.checked }))} />
                    </div>
                  )}
                </div>

                {form.usePools && (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.65rem' }}>Count (Min 2)</label>
                      <input className="form-input" type="number" min="2" max="10" value={form.poolCount}
                        onChange={e => setForm(f => ({ ...f, poolCount: e.target.value }))} style={{ width: '70px' }} />
                    </div>
                    
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                      {Array.from({ length: Number(form.poolCount) || 2 }).map((_, i) => {
                        const names = form.poolNames.split(',').map(n => n.trim());
                        const currentName = names[i] || '';
                        const defaultChar = String.fromCharCode(65 + i);
                        
                        return (
                          <div key={i} className="form-group">
                            <label className="form-label" style={{ fontSize: '0.65rem' }}>{defaultChar} Label</label>
                            <input 
                              className="form-input" 
                              placeholder={`e.g. Gold`}
                              value={currentName}
                              style={{ height: '32px', fontSize: '0.85rem' }}
                              onChange={e => {
                                const newNames = [...names];
                                while (newNames.length < (i + 1)) newNames.push('');
                                newNames[i] = e.target.value;
                                setForm(f => ({ ...f, poolNames: newNames.join(',') }));
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Capacity (Max Teams)</label>
                  <input className="form-input" type="number" placeholder="e.g. 8" value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.3rem', lineHeight: 1.4 }}>
                    When accepted teams reach this number, new registrations go to the waitlist automatically. Leave blank for no limit.
                  </p>
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.5rem' }}>
                    <input type="checkbox" checked={form.isClosed} onChange={e => setForm(f => ({ ...f, isClosed: e.target.checked }))} style={{ width: 16, height: 16 }} />
                    <span style={{ fontWeight: 500 }}>Close Registration</span>
                  </label>
                  <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.3rem', lineHeight: 1.4 }}>
                    Blocks all new registrations for this division on the public form immediately.
                  </p>
                </div>
              </div>

              {/* Fee Schedule Section */}
              <div className="form-group" style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-2)', paddingTop: '1.5rem' }}>
                <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>Fee Schedule (Division Override)</label>
                <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Set fees here only when the tournament uses per-division fee mode. Leave blank to inherit from tournament settings.
                </p>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Deposit Amount ($)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 200" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deposit Due Date</label>
                    <input className="form-input" type="date" value={form.depositDueDate} onChange={e => setForm(f => ({ ...f, depositDueDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Fee ($)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="e.g. 500" value={form.totalFeeAmount} onChange={e => setForm(f => ({ ...f, totalFeeAmount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Fee Due Date</label>
                    <input className="form-input" type="date" value={form.totalFeeDueDate} onChange={e => setForm(f => ({ ...f, totalFeeDueDate: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Tie Breakers Section */}
              <div className="form-group" style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border-2)', paddingTop: '1.5rem' }}>
                <label className="form-label" style={{ marginBottom: '0.75rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trophy size={14} /> Standing Tie-Breaker Hierarchy
                </label>
                <p className="form-help" style={{ fontSize: '0.7rem', color: 'var(--white-30)', marginBottom: '1rem' }}>
                  Drag to reorder. These rules are used to rank teams in the standings and determine playoff seeding.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px' }}>
                  {form.tieBreakers.map((b, i) => (
                    <div key={b} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: 'var(--white-5)', 
                      padding: '0.5rem 0.75rem', 
                      borderRadius: '2px', 
                      border: '1px solid var(--border-2)' 
                    }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--logic-lime)', minWidth: '15px' }}>{i + 1}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{breakerLabels[b]}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0.15rem' }} onClick={() => moveBreaker(i, 'up')} disabled={i === 0}>
                          <ChevronUp size={14} />
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0.15rem' }} onClick={() => moveBreaker(i, 'down')} disabled={i === form.tieBreakers.length - 1}>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="age-group-save-btn"><Check size={14} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Division?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              This will permanently delete this division. Teams, games, and results in this division will remain but lose their division link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} id="confirm-delete-age-group"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
