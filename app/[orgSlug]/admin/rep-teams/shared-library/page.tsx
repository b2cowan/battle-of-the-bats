'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, ChevronLeft, Pencil, Trash2, GitMerge, Plus, Check, X, Archive, RotateCcw } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import AwardIconPicker from '@/components/coaches/AwardIconPicker';
import type { RepTeamTag, RepTeamAwardType } from '@/lib/types';
import styles from '../rep-teams.module.css';

// Org-authored shared library (Coach Tags & Player Awards, Phase 3). The org owner/admin curates a
// small set of game tags, money tags, and award types that EVERY team can use — a top-down
// alternative to bottom-up promotion (which doesn't scale past a handful of teams). Shared items
// appear in every team's picker in blue, above each team's own private items.

type TagKind = 'game' | 'expense';

function TagSection({
  kind, label, hint, orgQuery, canWrite,
}: {
  kind: TagKind; label: string; hint: string; orgQuery: string; canWrite: boolean;
}) {
  const [tags, setTags] = useState<RepTeamTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-tags${orgQuery}&kind=${kind}`);
      if (!res.ok) throw new Error('Could not load shared tags.');
      const data = await res.json();
      setTags(data.tags ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shared tags.');
    } finally {
      setLoading(false);
    }
  }, [orgQuery, kind]);
  useEffect(() => { load(); }, [load]);

  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  async function addTag() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-tags${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add tag');
      setNewName('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add tag'); }
    finally { setAdding(false); }
  }

  async function saveRename(id: string) {
    const name = renameDraft.trim();
    if (!name) return;
    setBusyId(id); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-tags/${id}${orgQuery}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Rename failed');
      setRenamingId(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Rename failed'); }
    finally { setBusyId(null); }
  }

  async function removeTag(tag: RepTeamTag) {
    if (!window.confirm(`Delete shared tag "${tag.name}"? Anything tagged with it loses that tag. Use Merge instead to keep the history under another tag.`)) return;
    setBusyId(tag.id); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-tags/${tag.id}${orgQuery}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusyId(null); }
  }

  async function confirmMerge(loser: RepTeamTag) {
    const winner = tags.find(t => t.id === mergeTargetId);
    if (!winner) return;
    if (!window.confirm(`Merge "${loser.name}" into "${winner.name}"? Everything tagged "${loser.name}" will be re-tagged "${winner.name}", and "${loser.name}" will be removed.`)) return;
    setBusyId(loser.id); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-tags/merge${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerTagId: winner.id, loserTagId: loser.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Merge failed');
      setMergingId(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Merge failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div className={styles.detailSection} style={{ marginBottom: '1.25rem' }}>
      <p className={styles.detailSectionTitle}>{label}</p>
      <p className={styles.muted} style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>{hint}</p>

      {loading ? <p className={styles.muted}>Loading…</p> : (
        <>
          {sorted.length === 0 && <p className={styles.muted} style={{ fontSize: '0.85rem' }}>No shared {label.toLowerCase()} yet.</p>}
          {sorted.map(tag => (
            <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--white-8)' }}>
              {renamingId === tag.id ? (
                <>
                  <input className={styles.input} style={{ flex: 1 }} value={renameDraft} maxLength={40} autoFocus
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(tag.id); if (e.key === 'Escape') setRenamingId(null); }} />
                  <button className={styles.btnSecondary} disabled={busyId === tag.id || !renameDraft.trim()} onClick={() => saveRename(tag.id)}><Check size={14} /></button>
                  <button className={styles.btnGhost} onClick={() => setRenamingId(null)}><X size={14} /></button>
                </>
              ) : mergingId === tag.id ? (
                <>
                  <select className={styles.input} style={{ flex: 1 }} value={mergeTargetId} autoFocus onChange={e => setMergeTargetId(e.target.value)}>
                    <option value="">Merge “{tag.name}” into…</option>
                    {sorted.filter(t => t.id !== tag.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button className={styles.btnSecondary} disabled={busyId === tag.id || !mergeTargetId} onClick={() => confirmMerge(tag)}>Merge</button>
                  <button className={styles.btnGhost} onClick={() => setMergingId(null)}><X size={14} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{tag.name}</span>
                  {canWrite && (
                    <>
                      <button className={styles.btnGhost} title="Rename" disabled={!!busyId} onClick={() => { setRenamingId(tag.id); setRenameDraft(tag.name); setMergingId(null); }}><Pencil size={14} /></button>
                      {sorted.length > 1 && (
                        <button className={styles.btnGhost} title="Merge into another tag" disabled={!!busyId} onClick={() => { setMergingId(tag.id); setMergeTargetId(''); setRenamingId(null); }}><GitMerge size={14} /></button>
                      )}
                      <button className={styles.btnGhost} title="Delete" disabled={!!busyId} onClick={() => removeTag(tag)}><Trash2 size={14} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}

          {canWrite && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input className={styles.input} style={{ flex: 1 }} placeholder={`Add a shared ${label.toLowerCase().replace(/s$/, '')}…`} value={newName} maxLength={40}
                onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTag(); }} />
              <button className={styles.btnPrimary} disabled={adding || !newName.trim()} onClick={addTag}><Plus size={14} /> Add</button>
            </div>
          )}
        </>
      )}
      {error && <p className={styles.errorText} style={{ marginTop: '0.5rem' }}>{error}</p>}
    </div>
  );
}

function AwardTypeSection({ orgQuery, canWrite }: { orgQuery: string; canWrite: boolean }) {
  const [types, setTypes] = useState<RepTeamAwardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState<string | null>('🏆');
  const [adding, setAdding] = useState(false);
  const [pickerFor, setPickerFor] = useState<'new' | string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRetired, setShowRetired] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-award-types${orgQuery}`);
      if (!res.ok) throw new Error('Could not load shared award types.');
      const data = await res.json();
      setTypes(data.awardTypes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shared award types.');
    } finally {
      setLoading(false);
    }
  }, [orgQuery]);
  useEffect(() => { load(); }, [load]);

  const active = types.filter(t => t.isActive);
  const retired = types.filter(t => !t.isActive);

  async function addType() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-award-types${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji: newEmoji }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add award type');
      setNewName(''); setNewEmoji('🏆');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add award type'); }
    finally { setAdding(false); }
  }

  async function patchType(id: string, body: { name?: string; emoji?: string | null; isActive?: boolean }) {
    setBusyId(id); setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/shared-award-types/${id}${orgQuery}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      setEditId(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div className={styles.detailSection}>
      <p className={styles.detailSectionTitle}>Award types</p>
      <p className={styles.muted} style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>
        Standardize the awards every team hands out (e.g. MVP, Hustle). Retiring keeps past awards intact — it just removes the type from the picker.
      </p>

      {loading ? <p className={styles.muted}>Loading…</p> : (
        <>
          {active.length === 0 && <p className={styles.muted} style={{ fontSize: '0.85rem' }}>No shared award types yet.</p>}
          {active.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--white-8)' }}>
              {editId === t.id ? (
                <>
                  <button className={styles.btnSecondary} style={{ fontSize: '1.05rem', padding: '0.2rem 0.5rem' }} onClick={() => setPickerFor(t.id)}>{editEmoji ?? '—'}</button>
                  <input className={styles.input} style={{ flex: 1 }} value={editName} maxLength={40} autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') patchType(t.id, { name: editName.trim(), emoji: editEmoji }); if (e.key === 'Escape') setEditId(null); }} />
                  <button className={styles.btnSecondary} disabled={busyId === t.id || !editName.trim()} onClick={() => patchType(t.id, { name: editName.trim(), emoji: editEmoji })}><Check size={14} /></button>
                  <button className={styles.btnGhost} onClick={() => setEditId(null)}><X size={14} /></button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '1.05rem', width: '1.6rem', textAlign: 'center' }}>{t.emoji ?? '—'}</span>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{t.name}</span>
                  {canWrite && (
                    <>
                      <button className={styles.btnGhost} title="Edit name & icon" disabled={!!busyId} onClick={() => { setEditId(t.id); setEditName(t.name); setEditEmoji(t.emoji); }}><Pencil size={14} /></button>
                      <button className={styles.btnGhost} title="Retire" disabled={!!busyId} onClick={() => patchType(t.id, { isActive: false })}><Archive size={14} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}

          {canWrite && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className={styles.btnSecondary} style={{ fontSize: '1.05rem', padding: '0.2rem 0.6rem' }} onClick={() => setPickerFor('new')}>{newEmoji ?? '＋'}</button>
              <input className={styles.input} style={{ flex: 1 }} placeholder="Add a shared award type…" value={newName} maxLength={40}
                onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addType(); }} />
              <button className={styles.btnPrimary} disabled={adding || !newName.trim()} onClick={addType}><Plus size={14} /> Add</button>
            </div>
          )}

          {retired.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <button className={styles.btnGhost} style={{ fontSize: '0.8rem' }} onClick={() => setShowRetired(s => !s)}>
                {showRetired ? 'Hide' : 'Show'} retired ({retired.length})
              </button>
              {showRetired && retired.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', opacity: 0.7 }}>
                  <span style={{ fontSize: '1.05rem', width: '1.6rem', textAlign: 'center' }}>{t.emoji ?? '—'}</span>
                  <span style={{ flex: 1, fontSize: '0.9rem' }}>{t.name}</span>
                  {canWrite && (
                    <button className={styles.btnGhost} title="Restore" disabled={!!busyId} onClick={() => patchType(t.id, { isActive: true })}><RotateCcw size={14} /> Restore</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className={styles.errorText} style={{ marginTop: '0.5rem' }}>{error}</p>}

      {pickerFor && (
        <AwardIconPicker
          value={pickerFor === 'new' ? newEmoji : editEmoji}
          onSelect={(emoji) => { if (pickerFor === 'new') setNewEmoji(emoji); else setEditEmoji(emoji); setPickerFor(null); }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}

export default function AdminSharedLibraryPage() {
  const { currentOrg, userRole } = useOrg();
  const orgSlug = currentOrg?.slug ?? '';
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const base = `/${orgSlug}/admin/rep-teams`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  if (!orgSlug) return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;

  return (
    <div className={styles.page}>
      <Link href={base} className={styles.breadcrumb}><ChevronLeft size={14} /> Rep Teams</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Tag size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Shared library</h1>
            <p className={styles.pageSub}>Tags &amp; award types every team can use</p>
          </div>
        </div>
      </div>

      <p className={styles.muted} style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', maxWidth: 640 }}>
        Curate a small set of tags and award types shared across every team in your organization. They appear in each team&rsquo;s picker (in blue) alongside that team&rsquo;s own private ones. Teams can use them but can&rsquo;t rename or delete them — that stays here.
      </p>

      <TagSection kind="game" label="Game tags" hint="Applied to games on the schedule (e.g. Provincials, Rivalry Week)." orgQuery={orgQuery} canWrite={canWrite} />
      <TagSection kind="expense" label="Money tags" hint="Applied to expenses in the money area (e.g. Winter dome, Fundraiser)." orgQuery={orgQuery} canWrite={canWrite} />
      <AwardTypeSection orgQuery={orgQuery} canWrite={canWrite} />
    </div>
  );
}
