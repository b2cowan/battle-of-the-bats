'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Megaphone, Plus, Pencil, Trash2, X, Check, Star } from 'lucide-react';
import { getAnnouncements, saveAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Announcement } from '@/lib/types';
import styles from './announcements-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AdminAnnouncementsPage() {
  const { currentTournament } = useTournament();
  const [items, setItems] = useState<Announcement[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });

  async function refresh() { setItems(await getAnnouncements(currentTournament?.id)); }
  useEffect(() => { refresh(); }, [currentTournament?.id]);

  function openAdd() {
    setForm({ title: '', body: '', pinned: false });
    setEditing(null);
    setModal('add');
  }

  function openEdit(a: Announcement) {
    setForm({ title: a.title, body: a.body, pinned: a.pinned });
    setEditing(a);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const data = { tournamentId: currentTournament.id, ...form, title: form.title.trim(), body: form.body.trim(), date: editing?.date ?? new Date().toISOString() };
    if (modal === 'add') await saveAnnouncement(data);
    else if (editing) await updateAnnouncement(editing.id, data);
    setModal(null);
    refresh();
  }

  async function togglePin(id: string, pinned: boolean) {
    await updateAnnouncement(id, { pinned: !pinned });
    refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Megaphone size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Public News Posts</h1>
            <p className={styles.pageSub}>Publish updates to the tournament News page. This does not send email.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="ann-add-btn" disabled={!currentTournament}><Plus size={16} /> New Public Post</button>
      </div>

      <div className={styles.deliveryNote}>
        <div>
          <strong>Public post only</strong>
          <span>These updates appear on the public tournament News page. To send an email, use Communication.</span>
        </div>
        <Link className="btn btn-outline btn-sm" href="/admin/communication">
          <Mail size={14} /> Email Teams
        </Link>
      </div>

      <div className={styles.annList}>
        {items.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={40} />
            <p>No public news posts yet. Create one above.</p>
          </div>
        ) : items.map(ann => (
          <div key={ann.id} className={`card ${styles.annCard} ${ann.pinned ? styles.pinned : ''}`}>
            <div className={styles.annHeader}>
              <div className={styles.annMeta}>
                {ann.pinned && <span className="badge badge-primary"><Star size={9} fill="currentColor" />&nbsp;Pinned</span>}
                <span className={styles.annDate}>
                  {new Date((ann.date.includes('T') ? ann.date.split('T')[0] : ann.date) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  className={`btn btn-sm ${ann.pinned ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => togglePin(ann.id, ann.pinned)}
                  title={ann.pinned ? 'Unpin' : 'Pin'}
                  id={`pin-ann-${ann.id}`}
                >
                  <Star size={12} fill={ann.pinned ? 'currentColor' : 'none'} />
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ann)} id={`edit-ann-${ann.id}`}><Pencil size={13} /></button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(ann.id)} id={`delete-ann-${ann.id}`}><Trash2 size={13} /></button>
              </div>
            </div>
            <h3 className={styles.annTitle}>{ann.title}</h3>
            <p className={styles.annBody}>{ann.body.slice(0, 200)}{ann.body.length > 200 ? '…' : ''}</p>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'New Public Post' : 'Edit Public Post'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <p className={styles.modalHelp}>
              This will publish to the public tournament News page only. It will not email teams, coaches, or contacts.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Public post title" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Body *</label>
                <textarea className="form-textarea" placeholder="Write the public News page update here..." rows={12} value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))} required style={{ fontSize: '1rem', lineHeight: '1.6' }} />
              </div>
              <div className={styles.pinnedToggle}>
                <input type="checkbox" id="ann-pinned" checked={form.pinned}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
                <label htmlFor="ann-pinned">
                  <Star size={14} /> Pin this public post at the top of the News page
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="ann-save-btn"><Check size={14} /> Publish to News Page</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Public Post?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>This will permanently remove this post from the public News page.</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => { await deleteAnnouncement(deleteId); setDeleteId(null); refresh(); }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
