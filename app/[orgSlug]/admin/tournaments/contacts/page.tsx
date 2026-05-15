'use client';
import { useState, useEffect, useCallback } from 'react';
import { BookUser, Plus, Pencil, Trash2, X, Check, Mail, Phone, CheckCircle2, Circle, Info } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { Contact } from '@/lib/types';
import styles from '../age-groups/admin-page.module.css';

type ModalMode = 'add' | 'edit' | null;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

export default function AdminContactsPage() {
  const { currentTournament } = useTournament();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '', setAsPublic: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingNotif, setSettingNotif] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentTournament?.id) { setContacts([]); return; }
    const rows = await requestJson<Contact[]>(`/api/admin/contacts?tournamentId=${currentTournament.id}`);
    setContacts(rows);
  }, [currentTournament?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function setPublicContact(email: string) {
    if (!currentTournament) return;
    setSettingNotif(email);
    await fetch('/api/admin/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set-contact-email',
        id: currentTournament.id,
        data: { contactEmail: email },
      }),
    });
    setSettingNotif(null);
    window.location.reload();
  }

  function openAdd() {
    setForm({ name: '', email: '', phone: '', role: '', setAsPublic: !currentTournament?.contactEmail });
    setEditing(null);
    setModal('add');
  }

  function openEdit(c: Contact) {
    setForm({ name: c.name, email: c.email, phone: c.phone || '', role: c.role || '', setAsPublic: false });
    setEditing(c);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const data = {
      tournamentId: currentTournament.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role: form.role.trim() || undefined,
    };
    if (modal === 'add') {
      await requestJson('/api/admin/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', data }),
      });
      if (form.setAsPublic) {
        await fetch('/api/admin/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set-contact-email', id: currentTournament.id, data: { contactEmail: data.email } }),
        });
      }

    } else if (editing) {
      await requestJson('/api/admin/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: editing.id, data }),
      });
    }
    setModal(null);
    if (form.setAsPublic && modal === 'add') {
      window.location.reload();
    } else {
      void refresh();
    }
  }

  const notifContact = contacts.find(c => c.email === currentTournament?.contactEmail);
  const hasNotifContact = !!notifContact;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><BookUser size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Contacts</h1>
            <p className={styles.pageSub}>Manage tournament coordinators and contacts</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd} disabled={!currentTournament}>
          <Plus size={16} /> Add Contact
        </button>
      </div>

      {/* Public contact callout */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        marginBottom: '1.25rem',
        border: `1px solid ${hasNotifContact ? 'rgba(var(--logic-lime-rgb),0.25)' : 'rgba(245,158,11,0.35)'}`,
        borderRadius: '8px',
        background: hasNotifContact ? 'rgba(var(--logic-lime-rgb),0.04)' : 'rgba(245,158,11,0.06)',
        fontSize: '0.82rem',
        color: 'var(--white-60)',
        lineHeight: 1.5,
      }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: '0.1rem', color: hasNotifContact ? 'var(--logic-lime)' : '#f59e0b' }} />
        <div>
          {hasNotifContact ? (
            <>
              <strong style={{ color: 'var(--white-80)' }}>{notifContact.name}</strong>
              {' '}({notifContact.email}) is the public contact for this tournament.
              Coaches will see this email for questions and it appears in outgoing notification footers.
            </>
          ) : (
            <>
              <strong style={{ color: '#f59e0b' }}>No public contact set.</strong>
              {' '}Add a contact and click <strong>Set</strong> in the Notifications column to designate one.
              A public contact email is required before this tournament can go live.
            </>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Public Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>No contacts added yet.</td></tr>
            ) : contacts.map(c => {
              const isNotifContact = currentTournament?.contactEmail === c.email;
              return (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.role ? <span className="badge badge-primary">{c.role}</span> : '—'}</td>
                  <td>
                    <a href={`mailto:${c.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--white-60)' }}>
                      <Mail size={12} /> {c.email}
                    </a>
                  </td>
                  <td>
                    {c.phone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--white-60)' }}>
                        <Phone size={12} /> {c.phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {isNotifContact ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--logic-lime)', fontSize: '0.8rem', fontWeight: 700 }}>
                        <CheckCircle2 size={15} /> Public contact
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Make this the public contact for this tournament"
                        disabled={settingNotif !== null}
                        onClick={() => setPublicContact(c.email)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--white-35)', fontSize: '0.75rem' }}
                      >
                        <Circle size={14} /> Select
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(c.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Contact' : 'Edit Contact'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" placeholder="e.g. Jane Doe" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input className="form-input" placeholder="e.g. Tournament Director" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="jane@example.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="e.g. 555-0123" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              {modal === 'add' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--white-60)' }}>
                  <input
                    type="checkbox"
                    checked={form.setAsPublic}
                    onChange={e => setForm(f => ({ ...f, setAsPublic: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--blueprint-blue)' }}
                  />
                  Set as public contact for this tournament
                </label>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Save</button>
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
              <h3>Delete Contact?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              This will permanently delete this contact. If they are the current public contact, the tournament will lose its public email until you assign another.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => {
                await requestJson('/api/admin/contacts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'delete', id: deleteId }),
                });
                setDeleteId(null);
                void refresh();
              }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
