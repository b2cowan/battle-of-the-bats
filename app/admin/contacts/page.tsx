'use client';
import { useState, useEffect } from 'react';
import { BookUser, Plus, Pencil, Trash2, X, Check, Mail, Phone } from 'lucide-react';
import { getContacts, saveContact, updateContact, deleteContact } from '@/lib/storage';
import { Contact } from '@/lib/types';
import styles from '../age-groups/admin-page.module.css'; // Reuse styles

type ModalMode = 'add' | 'edit' | null;

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function refresh() { setContacts(getContacts()); }
  useEffect(refresh, []);

  function openAdd() {
    setForm({ name: '', email: '', phone: '', role: '' });
    setEditing(null);
    setModal('add');
  }

  function openEdit(c: Contact) {
    setForm({ name: c.name, email: c.email, phone: c.phone || '', role: c.role || '' });
    setEditing(c);
    setModal('edit');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role: form.role.trim() || undefined,
    };
    if (modal === 'add') saveContact(data);
    else if (editing) updateContact(editing.id, data);
    setModal(null);
    refresh();
  }

  function handleDelete() {
    if (deleteId) { deleteContact(deleteId); setDeleteId(null); refresh(); }
  }

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
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Contact
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>No contacts added yet.</td></tr>
            ) : contacts.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.role ? <span className="badge badge-purple">{c.role}</span> : '—'}</td>
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
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(c.id)}><Trash2 size={13} /></button>
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
                  <input className="form-input" placeholder="e.g. U11 Coordinator" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="jane@b2cowan.com" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="e.g. 555-0123" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
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
              This will permanently delete this contact. If this contact is assigned to any age groups, they will revert to the default admin email.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
