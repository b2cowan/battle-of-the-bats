'use client';
import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, FileText, Shield, AlertCircle, CheckCircle,
  Plus, Trash2, GripVertical, Upload,
  RefreshCw, Link as LinkIcon,
  HelpCircle, Info, X, Check, ExternalLink, Pencil,
  LayoutList, LayoutGrid, Columns2
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Tournament, RuleSection, Resource, AgeGroup } from '@/lib/types';
import {
  getRules, saveRuleSection, updateRuleSection, deleteRuleSection,
  saveRuleItem, updateRuleItem, deleteRuleItem,
  getResources, saveResource, updateResource, deleteResource,
  uploadResourceFile
} from '@/lib/db';
import SamplesDrawer from './SamplesDrawer';
import { SampleSection, SampleResource } from './rules-samples';
import styles from '../../admin-common.module.css';

interface Props {
  tournament: Tournament;
  orgSlug?: string;
}

const ICONS = [
  { name: 'Shield',       Icon: Shield       },
  { name: 'BookOpen',     Icon: BookOpen     },
  { name: 'AlertCircle',  Icon: AlertCircle  },
  { name: 'CheckCircle',  Icon: CheckCircle  },
  { name: 'Info',         Icon: Info         },
  { name: 'HelpCircle',   Icon: HelpCircle   },
];

// ── Sortable resource row ─────────────────────────────────────────────────────
function SortableResource({
  res, editingResourceId, startEditingResource, handleDeleteResource,
  editingResourceLabel, setEditingResourceLabel,
  editingResourceUrl,   setEditingResourceUrl,
  saveResourceEdit,     setEditingResourceId,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: res.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`resource-edit-card ${isDragging ? 'dragging' : ''}`}>
      {editingResourceId === res.id ? (
        <div className="resource-edit-form">
          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="tiny-label">Display Name</label>
              <input autoFocus className="form-input sm" value={editingResourceLabel} onChange={e => setEditingResourceLabel(e.target.value)} />
            </div>
            <div className="form-group flex-1">
              <label className="tiny-label">URL / Path</label>
              <input className="form-input sm" value={editingResourceUrl} onChange={e => setEditingResourceUrl(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button className="btn btn-lime btn-data" onClick={saveResourceEdit}><Check size={12} /> Save</button>
            <button className="btn btn-ghost btn-data" onClick={() => setEditingResourceId(null)}><X size={12} /> Cancel</button>
          </div>
        </div>
      ) : (
        <div className="resource-header">
          <div className="resource-icon-box">
            {res.url.includes('supabase') ? <FileText size={16} /> : <LinkIcon size={16} />}
          </div>
          <div className="resource-meta">
            <span className="resource-display-label">{res.label}</span>
            <span className="resource-display-url">{res.url}</span>
          </div>
          <div className="resource-actions">
            <button className="icon-btn-ghost" onClick={() => startEditingResource(res)}><Pencil size={14} /></button>
            <button className="icon-btn-danger" onClick={() => handleDeleteResource(res.id)}><Trash2 size={14} /></button>
          </div>
          <div className="drag-handle-right" {...attributes} {...listeners}><GripVertical size={18} /></div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RulesAdmin({ tournament, orgSlug }: Props) {
  const [rules, setRules]         = useState<RuleSection[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Unified dirty tracking — IDs of sections / items with unsaved local edits
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [dirtyItems,    setDirtyItems]    = useState<Set<string>>(new Set());
  const isDirty = dirtySections.size > 0 || dirtyItems.size > 0;

  // Navigation warning
  const [showNavWarning,  setShowNavWarning]  = useState(false);
  const isDirtyRef   = useRef(isDirty);
  const pendingNavRef = useRef<(() => void) | null>(null);

  // Per-section save/discard UX — only one section in "pending" state at a time
  const [activeDirtySectionId, setActiveDirtySectionId] = useState<string | null>(null);
  const [switchGuardTargetId,  setSwitchGuardTargetId]  = useState<string | null>(null);

  // Phase 1 — confirmation modals
  const [deleteConfirmSectionId,  setDeleteConfirmSectionId]  = useState<string | null>(null);
  const [deleteConfirmResourceId, setDeleteConfirmResourceId] = useState<string | null>(null);

  // Phase 2 — inline add-section
  const [showNewSectionCard,    setShowNewSectionCard]    = useState(false);
  const [newSectionTitleInline, setNewSectionTitleInline] = useState('');

  // Phase 3 — samples drawer
  const [showSamples,  setShowSamples]  = useState(false);
  const [addingSample, setAddingSample] = useState<string | null>(null);

  // Inline edit states (UI only — values committed to `rules` state on confirm)
  const [editingSectionId,    setEditingSectionId]    = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // Resource edit states (saved immediately, no dirty tracking)
  const [editingResourceId,    setEditingResourceId]    = useState<string | null>(null);
  const [editingResourceLabel, setEditingResourceLabel] = useState('');
  const [editingResourceUrl,   setEditingResourceUrl]   = useState('');

  const [uploading, setUploading] = useState(false);

  // Layout settings — initialised from tournament.settings; saved immediately on toggle
  const [rulesLayout,     setRulesLayout]     = useState<'columns' | 'single'>(
    tournament.settings?.rulesLayout ?? 'columns'
  );
  const [resourcesLayout, setResourcesLayout] = useState<'list' | 'grid'>(
    tournament.settings?.resourcesLayout ?? 'list'
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Keep ref in sync so the pushState interceptor always sees current isDirty
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // Browser tab close / refresh guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // In-app navigation guard (intercepts Next.js Link / router.push)
  useEffect(() => {
    const orig = window.history.pushState.bind(window.history);
    window.history.pushState = function(state: any, unused: string, url?: string | URL | null) {
      if (isDirtyRef.current) {
        pendingNavRef.current = () => orig(state, unused, url);
        setShowNavWarning(true);
      } else {
        orig(state, unused, url);
      }
    };
    return () => { window.history.pushState = orig; };
  }, []);

  useEffect(() => { fetchData(); }, [tournament.id, orgSlug]);

  async function fetchData(opts: { silent?: boolean } = {}) {
    try {
      if (!opts.silent) setLoading(true);
      setError(null);
      const [r, res, agRes] = await Promise.all([
        getRules(tournament.id),
        getResources(tournament.id),
        fetch(`/api/admin/age-groups?tournamentId=${encodeURIComponent(tournament.id)}${orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : ''}`),
      ]);
      const ag = agRes.ok ? await agRes.json() : [];
      setRules(r);
      setResources(res);
      setAgeGroups(ag);
      // Clear dirty state — fresh data from DB is now authoritative
      setDirtySections(new Set());
      setDirtyItems(new Set());
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  }

  // ── Unified save ─────────────────────────────────────────────────────────
  async function handleSaveAll() {
    if (!isDirty) return;
    setSaving(true);
    try {
      await Promise.all([
        ...Array.from(dirtySections).map(id => {
          const s = rules.find(r => r.id === id);
          if (!s) return Promise.resolve();
          return updateRuleSection(id, { title: s.title, icon: s.icon, ageGroupIds: s.ageGroupIds });
        }),
        ...Array.from(dirtyItems).map(id => {
          const item = rules.flatMap(s => s.items).find(i => i.id === id);
          if (!item) return Promise.resolve();
          return updateRuleItem(id, { content: item.content });
        }),
      ]);
      setDirtySections(new Set());
      setDirtyItems(new Set());
      setActiveDirtySectionId(null);
    } catch (err) {
      console.error('[RulesAdmin] Save failed', err);
      alert('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation warning actions ────────────────────────────────────────────
  function handleNavStay() {
    setShowNavWarning(false);
    pendingNavRef.current = null;
  }

  function handleNavLeave() {
    setShowNavWarning(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    nav?.();
  }

  async function handleNavSaveAndLeave() {
    await handleSaveAll();
    handleNavLeave();
  }

  // ── Section edits (local only → dirty) ───────────────────────────────────
  function commitSectionTitle() {
    if (!editingSectionId) return;
    setRules(prev => prev.map(s => s.id === editingSectionId ? { ...s, title: editingSectionTitle } : s));
    setDirtySections(prev => new Set(prev).add(editingSectionId));
    setActiveDirtySectionId(editingSectionId);
    setEditingSectionId(null);
  }

  function handleUpdateSectionIcon(id: string, icon: string) {
    setRules(prev => prev.map(s => s.id === id ? { ...s, icon } : s));
    setDirtySections(prev => new Set(prev).add(id));
    setActiveDirtySectionId(id);
  }

  function handleUpdateSectionAgeGroups(id: string, ageGroupIds: string[] | null) {
    setRules(prev => prev.map(s => s.id === id ? { ...s, ageGroupIds } : s));
    setDirtySections(prev => new Set(prev).add(id));
    setActiveDirtySectionId(id);
  }

  // Item edits (local only → dirty)
  function handleUpdateItem(id: string, content: string) {
    setRules(prev => prev.map(s => ({
      ...s,
      items: s.items.map(i => i.id === id ? { ...i, content } : i),
    })));
    const parentSection = rules.find(s => s.items.some(i => i.id === id));
    if (parentSection) setActiveDirtySectionId(parentSection.id);
    setDirtyItems(prev => new Set(prev).add(id));
  }

  // ── Per-section save / discard ────────────────────────────────────────────
  async function handleSaveSection(id: string) {
    setSaving(true);
    try {
      const s = rules.find(r => r.id === id);
      const sectionItems = s?.items ?? [];
      if (s) await updateRuleSection(id, { title: s.title, icon: s.icon, ageGroupIds: s.ageGroupIds });
      await Promise.all(
        sectionItems
          .filter(i => dirtyItems.has(i.id))
          .map(i => updateRuleItem(i.id, { content: i.content }))
      );
      setDirtySections(prev => { const n = new Set(prev); n.delete(id); return n; });
      setDirtyItems(prev => {
        const n = new Set(prev);
        sectionItems.forEach(i => n.delete(i.id));
        return n;
      });
      setActiveDirtySectionId(null);
      setSwitchGuardTargetId(null);
    } catch {
      alert('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscardSection(id: string) {
    const sectionItems = rules.find(r => r.id === id)?.items ?? [];
    setDirtySections(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDirtyItems(prev => {
      const n = new Set(prev);
      sectionItems.forEach(i => n.delete(i.id));
      return n;
    });
    setActiveDirtySectionId(null);
    setSwitchGuardTargetId(null);
    await fetchData({ silent: true });
  }

  function handleSwitchGuardSave() {
    if (activeDirtySectionId) handleSaveSection(activeDirtySectionId);
  }

  function handleSwitchGuardDiscard() {
    if (activeDirtySectionId) handleDiscardSection(activeDirtySectionId);
  }

  // ── Phase 2 — Inline add-section ─────────────────────────────────────────
  async function handleAddInlineSection() {
    if (!newSectionTitleInline.trim()) return;
    setSaving(true);
    try {
      const id = await saveRuleSection({ tournamentId: tournament.id, title: newSectionTitleInline.trim(), icon: 'Shield', order: rules.length });
      if (!id) throw new Error('Save returned null');
      setShowNewSectionCard(false);
      setNewSectionTitleInline('');
      await fetchData();
    } catch { alert('Error adding section.'); }
    finally { setSaving(false); }
  }

  // ── Phase 1 — Confirm-modal delete handlers ───────────────────────────────
  function handleDeleteSection(id: string) {
    setDeleteConfirmSectionId(id);
  }

  async function confirmDeleteSection() {
    if (!deleteConfirmSectionId) return;
    setSaving(true);
    try { await deleteRuleSection(deleteConfirmSectionId); await fetchData(); }
    catch { alert('Delete failed.'); }
    finally { setSaving(false); setDeleteConfirmSectionId(null); }
  }

  function handleDeleteResource(id: string) {
    setDeleteConfirmResourceId(id);
  }

  async function confirmDeleteResource() {
    if (!deleteConfirmResourceId) return;
    setSaving(true);
    try { await deleteResource(deleteConfirmResourceId); await fetchData(); }
    catch { alert('Delete failed.'); }
    finally { setSaving(false); setDeleteConfirmResourceId(null); }
  }

  // ── Immediate mutations ───────────────────────────────────────────────────
  async function handleAddItem(ruleId: string) {
    const section = rules.find(s => s.id === ruleId);
    if (!section) return;
    await saveRuleItem({ ruleId, content: 'New rule point...', order: section.items.length });
    await fetchData();
  }

  async function handleDeleteItem(id: string) {
    await deleteRuleItem(id);
    await fetchData();
  }

  // ── Resource actions (immediate save, own Save button per row) ────────────
  async function handleAddResource() {
    setSaving(true);
    await saveResource({ tournamentId: tournament.id, label: 'New Link', url: 'https://', order: resources.length });
    await fetchData();
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadResourceFile(file);
      if (url) { await saveResource({ tournamentId: tournament.id, label: file.name, url, order: resources.length }); await fetchData(); }
    } catch { alert('Upload failed.'); }
    finally { setUploading(false); }
  }

  async function saveResourceEdit() {
    if (!editingResourceId) return;
    await updateResource(editingResourceId, { label: editingResourceLabel, url: editingResourceUrl });
    setResources(prev => prev.map(r => r.id === editingResourceId ? { ...r, label: editingResourceLabel, url: editingResourceUrl } : r));
    setEditingResourceId(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = resources.findIndex(r => r.id === active.id);
    const newIndex = resources.findIndex(r => r.id === over.id);
    const newArray = arrayMove(resources, oldIndex, newIndex);
    setResources(newArray);
    setSaving(true);
    try {
      for (let i = 0; i < newArray.length; i++) {
        if (newArray[i].order !== i) await updateResource(newArray[i].id, { order: i });
      }
    } catch { console.error('Failed to save order'); }
    finally { setSaving(false); }
  }

  // ── Layout settings ───────────────────────────────────────────────────────
  async function handleLayoutChange(
    key: 'rulesLayout' | 'resourcesLayout',
    value: string,
  ) {
    // Optimistic update
    if (key === 'rulesLayout')     setRulesLayout(value as 'columns' | 'single');
    if (key === 'resourcesLayout') setResourcesLayout(value as 'list' | 'grid');

    try {
      const qs = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      await fetch(`/api/admin/tournaments${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'patch-settings',
          id: tournament.id,
          data: { settings: { [key]: value } },
        }),
      });
    } catch (err) {
      console.error('[RulesAdmin] Failed to save layout setting', err);
    }
  }

  // ── Phase 3 — Sample add handlers ─────────────────────────────────────────
  async function handleAddSampleSection(sample: SampleSection, index: number) {
    setAddingSample(`section-${index}`);
    try {
      const id = await saveRuleSection({ tournamentId: tournament.id, title: sample.title, icon: sample.icon, order: rules.length });
      if (id) {
        for (let i = 0; i < sample.items.length; i++) {
          await saveRuleItem({ ruleId: id, content: sample.items[i], order: i });
        }
      }
      await fetchData();
    } catch { alert('Failed to add sample.'); }
    finally { setAddingSample(null); }
  }

  async function handleAddSampleResource(sample: SampleResource, index: number) {
    setAddingSample(`resource-${index}`);
    try {
      await saveResource({ tournamentId: tournament.id, label: sample.label, url: sample.url || '#', order: resources.length });
      await fetchData();
    } catch { alert('Failed to add sample resource.'); }
    finally { setAddingSample(null); }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.page}>
        <div className="flex-center" style={{ height: '400px' }}>
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="spin text-primary-light" size={48} />
            <p className="text-white-40 font-bold tracking-widest uppercase text-xs">Loading Rules...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><BookOpen size={24} /></div>
          <div>
            <h1 className={styles.pageTitle}>Rules & Resources</h1>
            <p className={styles.pageSub}>Manage rules and downloads for {tournament.name}.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {isDirty && (
            <span className="header-unsaved-badge">
              <AlertCircle size={12} /> Unsaved changes
            </span>
          )}
          <button className="btn btn-outline btn-data" onClick={() => setShowSamples(true)}>
            <BookOpen size={14} /> Browse Samples
          </button>
        </div>
      </header>

      {error && (
        <div className="card" style={{ background: 'rgba(var(--danger-rgb),0.1)', marginBottom: '2rem' }}>
          <div className="flex gap-3 items-center text-danger">
            <AlertCircle size={20} />
            <p style={{ fontWeight: 600 }}>{error}</p>
          </div>
        </div>
      )}

      <div className="single-column-layout">
        {/* ── Rules sections ── */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Tournament Rules</h2>
            <div className="section-header-actions">
              <div className="layout-toggle-group">
                <span className="layout-toggle-label">Public layout</span>
                <div className="layout-toggle">
                  <button
                    className={`layout-toggle-btn${rulesLayout === 'single' ? ' active' : ''}`}
                    onClick={() => handleLayoutChange('rulesLayout', 'single')}
                    title="Single column"
                  ><LayoutList size={15} /></button>
                  <button
                    className={`layout-toggle-btn${rulesLayout === 'columns' ? ' active' : ''}`}
                    onClick={() => handleLayoutChange('rulesLayout', 'columns')}
                    title="Two columns"
                  ><Columns2 size={15} /></button>
                </div>
              </div>
              <button
                className="btn btn-lime btn-data"
                onClick={() => { setShowNewSectionCard(true); setNewSectionTitleInline(''); }}
                disabled={!!activeDirtySectionId}
                title={activeDirtySectionId ? 'Save or discard the current section before adding a new one' : undefined}
              >
                <Plus size={14} /> Add Section
              </button>
            </div>
          </div>

          <div className={`rules-stack${rulesLayout === 'columns' ? ' rules-stack--grid' : ''}`}>
            {rules.map(section => {
              const isDirtySection = dirtySections.has(section.id);
              return (
                <div
                  key={section.id}
                  className={`rule-card ${isDirtySection ? 'rule-card-dirty' : ''}`}
                  onClickCapture={(e) => {
                    if (activeDirtySectionId && activeDirtySectionId !== section.id) {
                      const target = e.target as HTMLElement;
                      if (!target.closest('.section-save-bar')) {
                        e.stopPropagation();
                        setSwitchGuardTargetId(section.id);
                      }
                    }
                  }}
                >
                  <div className="rule-card-header">
                    <div className="rule-card-title-group">
                      <div className="icon-preview-box">
                        {(() => { const I = ICONS.find(i => i.name === (section.icon || 'Shield'))?.Icon || Shield; return <I size={20} />; })()}
                      </div>
                      <select
                        className="icon-select"
                        value={section.icon || 'Shield'}
                        onChange={e => handleUpdateSectionIcon(section.id, e.target.value)}
                      >
                        {ICONS.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
                      </select>

                      {editingSectionId === section.id ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <input
                            autoFocus
                            className="inline-title-input editing"
                            value={editingSectionTitle}
                            onChange={e => setEditingSectionTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitSectionTitle(); if (e.key === 'Escape') setEditingSectionId(null); }}
                          />
                          <button className="icon-btn-success" onClick={commitSectionTitle}><Check size={16} /></button>
                          <button className="icon-btn-ghost" onClick={() => setEditingSectionId(null)}><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex gap-2 flex-1 items-center group">
                          <h3 className="card-title-text">{section.title}</h3>
                          {isDirtySection && <span className="dirty-dot" title="Unsaved changes" />}
                          <button className="edit-pencil-btn" onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}>
                            <Pencil size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="delete-btn-mini" onClick={() => handleDeleteSection(section.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {ageGroups.length > 0 && (
                    <div className="applies-to-row">
                      <span className="applies-to-label">Applies to:</span>
                      {ageGroups.map(g => {
                        const allIds = ageGroups.map(ag => ag.id);
                        const current = section.ageGroupIds ?? allIds;
                        return (
                          <label key={g.id} className="applies-to-check">
                            <input
                              type="checkbox"
                              checked={current.includes(g.id)}
                              onChange={e => {
                                const next = e.target.checked ? [...current, g.id] : current.filter(id => id !== g.id);
                                const result = next.length === 0 || next.length === allIds.length ? null : next;
                                handleUpdateSectionAgeGroups(section.id, result);
                              }}
                            />
                            {g.name}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="rule-items-list">
                    {section.items.map(item => (
                      <div key={item.id} className="rule-item-row group">
                        <GripVertical size={14} className="drag-handle" />
                        <textarea
                          rows={1}
                          className="item-textarea"
                          value={item.content || ''}
                          onChange={e => handleUpdateItem(item.id, e.target.value)}
                        />
                        <button className="item-delete-btn" onClick={() => handleDeleteItem(item.id)}><X size={14} /></button>
                      </div>
                    ))}
                    <button className="add-item-btn" onClick={() => handleAddItem(section.id)}><Plus size={14} /> Add Point</button>
                  </div>

                  {activeDirtySectionId === section.id && (
                    <div className="section-save-bar">
                      <button
                        className="btn btn-ghost btn-data"
                        onClick={() => handleDiscardSection(section.id)}
                        disabled={saving}
                      >
                        <X size={14} /> Discard
                      </button>
                      <button
                        className="btn btn-lime btn-data"
                        onClick={() => handleSaveSection(section.id)}
                        disabled={saving}
                      >
                        <Check size={14} />
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Phase 2 — Inline new-section card */}
            {showNewSectionCard && (
              <div className="rule-card new-section-card">
                <div className="rule-card-header">
                  <div className="rule-card-title-group">
                    <div className="icon-preview-box"><Shield size={20} /></div>
                    <input
                      autoFocus
                      className="inline-title-input editing"
                      placeholder="Section title..."
                      value={newSectionTitleInline}
                      onChange={e => setNewSectionTitleInline(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newSectionTitleInline.trim()) handleAddInlineSection();
                        if (e.key === 'Escape') { setShowNewSectionCard(false); setNewSectionTitleInline(''); }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="icon-btn-success"
                      onClick={handleAddInlineSection}
                      disabled={!newSectionTitleInline.trim() || saving}
                      title="Confirm section"
                    ><Check size={16} /></button>
                    <button
                      className="icon-btn-ghost"
                      onClick={() => { setShowNewSectionCard(false); setNewSectionTitleInline(''); }}
                      title="Cancel"
                    ><X size={16} /></button>
                  </div>
                </div>
                <div className="rule-items-list">
                  <p style={{ color: 'var(--white-20)', fontSize: '0.8rem' }}>Confirm the section title to start adding rule points.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="divider-lg" />

        {/* ── Resources section ── */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Resources & Downloads</h2>
            <div className="section-header-actions">
              <div className="layout-toggle-group">
                <span className="layout-toggle-label">Public layout</span>
                <div className="layout-toggle">
                  <button
                    className={`layout-toggle-btn${resourcesLayout === 'list' ? ' active' : ''}`}
                    onClick={() => handleLayoutChange('resourcesLayout', 'list')}
                    title="Stacked list"
                  ><LayoutList size={15} /></button>
                  <button
                    className={`layout-toggle-btn${resourcesLayout === 'grid' ? ' active' : ''}`}
                    onClick={() => handleLayoutChange('resourcesLayout', 'grid')}
                    title="Two-column grid"
                  ><LayoutGrid size={15} /></button>
                </div>
              </div>
              <div className="add-form">
                <button className="btn btn-outline btn-data" onClick={handleAddResource}><LinkIcon size={14} /> Add Link</button>
                <button className="btn btn-lime btn-data" onClick={() => document.getElementById('file-up-main')?.click()}>
                  <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload File'}
                </button>
                <input type="file" id="file-up-main" hidden onChange={handleFileUpload} />
              </div>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={`resource-list-stack${resourcesLayout === 'grid' ? ' resource-list-stack--grid' : ''}`}>
              <SortableContext items={resources.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {resources.map(res => (
                  <SortableResource
                    key={res.id}
                    res={res}
                    editingResourceId={editingResourceId}
                    startEditingResource={(r: Resource) => { setEditingResourceId(r.id); setEditingResourceLabel(r.label); setEditingResourceUrl(r.url); }}
                    handleDeleteResource={handleDeleteResource}
                    editingResourceLabel={editingResourceLabel}
                    setEditingResourceLabel={setEditingResourceLabel}
                    editingResourceUrl={editingResourceUrl}
                    setEditingResourceUrl={setEditingResourceUrl}
                    saveResourceEdit={saveResourceEdit}
                    setEditingResourceId={setEditingResourceId}
                  />
                ))}
              </SortableContext>
              {resources.length === 0 && (
                <div className="empty-state-card">
                  <FileText size={48} className="text-white-10" />
                  <p>No resources or documents added yet.</p>
                </div>
              )}
            </div>
          </DndContext>
        </section>
      </div>

      {/* ── Phase 1: Delete section confirm modal ── */}
      {deleteConfirmSectionId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmSectionId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Section?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmSectionId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', padding: '0.25rem 0 1.25rem' }}>
              This will permanently remove this section and all its rule points.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmSectionId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteSection} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete Section'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 1: Delete resource confirm modal ── */}
      {deleteConfirmResourceId !== null && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmResourceId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Resource?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmResourceId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', padding: '0.25rem 0 1.25rem' }}>
              This will remove this link or file from the public Rules page.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirmResourceId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteResource} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete Resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Switch-section guard modal ── */}
      {switchGuardTargetId !== null && activeDirtySectionId && (
        <div className="modal-overlay" onClick={() => setSwitchGuardTargetId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Unsaved Changes</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSwitchGuardTargetId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', padding: '0.25rem 0 1.25rem' }}>
              You have unsaved changes in this section. Save or discard before editing a different section.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSwitchGuardTargetId(null)}>Keep editing</button>
              <button className="btn btn-danger" onClick={handleSwitchGuardDiscard} disabled={saving}>Discard changes</button>
              <button className="btn btn-primary" onClick={handleSwitchGuardSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation warning modal ── */}
      {showNavWarning && (
        <div className="modal-overlay" onClick={handleNavStay}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Unsaved Changes</h3>
              <button className="btn btn-ghost btn-sm" onClick={handleNavStay}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', padding: '0.25rem 0 1.25rem' }}>
              You have unsaved rule edits. If you leave now those changes will be lost.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleNavStay}>Stay &amp; keep editing</button>
              <button className="btn btn-danger" onClick={handleNavLeave}>Leave without saving</button>
              <button className="btn btn-primary" onClick={handleNavSaveAndLeave} disabled={saving}>
                {saving ? 'Saving…' : 'Save & leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3: Samples drawer ── */}
      {showSamples && (
        <SamplesDrawer
          onAddSection={handleAddSampleSection}
          onAddResource={handleAddSampleResource}
          onClose={() => setShowSamples(false)}
          adding={addingSample}
        />
      )}

      <style jsx global>{`
        .single-column-layout { display: flex; flex-direction: column; gap: 4rem; padding-bottom: 5rem; }
        .content-section { display: flex; flex-direction: column; gap: 1.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-subtle); }
        .section-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--white); margin: 0; }
        .section-header-actions { display: flex; align-items: center; gap: 0.75rem; }
        .add-form { display: flex; gap: 0.75rem; }

        /* Layout toggle — compact segmented control in section headers */
        .layout-toggle-group { display: flex; align-items: center; gap: 0.4rem; }
        .layout-toggle-label { font-family: var(--font-data); font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--white-20); white-space: nowrap; }
        .layout-toggle { display: flex; align-items: center; background: var(--bg-inset); border: 1px solid var(--border-subtle); border-radius: 6px; overflow: hidden; }
        .layout-toggle-btn { background: none; border: none; color: var(--white-30); cursor: pointer; padding: 5px 8px; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
        .layout-toggle-btn:hover { color: var(--white-70); background: var(--white-05); }
        .layout-toggle-btn.active { color: var(--logic-lime); background: rgba(var(--logic-lime-rgb), 0.08); }
        .add-form .form-input { max-width: 300px; height: 38px; }

        .rules-stack { display: flex; flex-direction: column; gap: 1.5rem; }
        .rules-stack--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
        .rule-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; transition: border-color 0.2s; }
        .rule-card-dirty { border-color: var(--logic-lime); }
        .new-section-card { border-style: dashed; border-color: var(--logic-lime); opacity: 0.85; }
        .dirty-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--logic-lime); flex-shrink: 0; }
        .rule-card-header { padding: 0.75rem 1.25rem; background: var(--bg-inset); border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; }
        .rule-card-title-group { display: flex; align-items: center; gap: 1rem; flex: 1; }
        .icon-preview-box { width: 32px; height: 32px; background: rgba(var(--blueprint-blue-rgb), 0.1); border: 1px solid rgba(var(--blueprint-blue-rgb), 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--logic-lime); flex-shrink: 0; }
        .icon-select { background: var(--bg-3); border: 1px solid var(--border); color: var(--white); border-radius: 6px; padding: 2px 6px; font-size: 0.8rem; }
        .card-title-text { font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: var(--white); margin: 0; }
        .inline-title-input { background: var(--black-20); border: 1px solid var(--blueprint-blue); outline: none; color: var(--white); font-family: var(--font-display); font-size: 1rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; width: 100%; }
        .edit-pencil-btn { background: none; border: none; color: var(--white-20); cursor: pointer; padding: 4px; opacity: 0; transition: opacity 0.2s; }
        .group:hover .edit-pencil-btn { opacity: 1; }
        .edit-pencil-btn:hover { color: var(--logic-lime); }
        .delete-btn-mini { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 6px; transition: color 0.2s; }
        .delete-btn-mini:hover { color: var(--danger); }

        .applies-to-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 1.25rem; background: var(--bg-inset); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
        .applies-to-label { font-size: 0.7rem; font-weight: 700; color: var(--white-40); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .applies-to-check { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--white-60); cursor: pointer; }

        .rule-items-list { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .rule-item-row { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.3rem; border-radius: 6px; }
        .rule-item-row:hover { background: var(--white-05); }
        .drag-handle { margin-top: 6px; color: var(--white-10); }
        .item-textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--white-80); font-size: 0.9rem; line-height: 1.5; resize: none; padding: 0; }
        .item-delete-btn { background: none; border: none; color: var(--white-10); cursor: pointer; opacity: 0; }
        .rule-item-row:hover .item-delete-btn { opacity: 1; color: var(--danger); }
        .add-item-btn { align-self: flex-start; background: none; border: 1px dashed var(--border-subtle); color: var(--text-tertiary); font-size: 0.7rem; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 99px; cursor: pointer; margin-top: 0.4rem; }
        .section-save-bar { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.75rem 1.25rem; background: var(--bg-inset); border-top: 1px solid var(--logic-lime); }
        .header-unsaved-badge { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; font-weight: 700; color: var(--logic-lime); letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.8; }

        .resource-list-stack { display: flex; flex-direction: column; gap: 0.5rem; }
        .resource-list-stack--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; align-items: start; }
        .resource-edit-card { background: var(--bg-inset); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.5rem 0.75rem; transition: transform 0.1s; }
        .resource-edit-card.dragging { background: var(--bg-3); border-color: var(--blueprint-blue); }
        .resource-header { display: flex; align-items: center; gap: 0.75rem; }
        .resource-icon-box { width: 30px; height: 30px; background: var(--white-05); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--logic-lime); flex-shrink: 0; }
        .resource-meta { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .resource-display-label { color: var(--white); font-weight: 700; font-size: 0.9rem; }
        .resource-display-url { color: var(--white-20); font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .resource-edit-form { display: flex; flex-direction: column; gap: 0.5rem; }
        .tiny-label { font-size: 0.6rem; font-weight: 800; color: var(--white-20); text-transform: uppercase; margin-bottom: -0.3rem; }
        .form-input.sm { padding: 3px 6px; font-size: 0.8rem; background: var(--black-20); }
        .resource-actions { display: flex; align-items: center; gap: 0.1rem; flex-shrink: 0; position: relative; z-index: 20; }
        .drag-handle-right { color: var(--white-10); cursor: grab; padding: 8px; margin-right: -4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
        .drag-handle-right:active { cursor: grabbing; color: var(--logic-lime); }
        .resource-edit-card:hover .drag-handle-right { color: var(--white-30); }
        .icon-btn-ghost { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .icon-btn-ghost:hover { background: var(--white-10); color: var(--white); }
        .icon-btn-success { background: var(--success); color: var(--white); border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .icon-btn-success:disabled { opacity: 0.3; cursor: not-allowed; }
        .icon-btn-danger { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .icon-btn-danger:hover { background: rgba(var(--danger-rgb),0.1); color: var(--danger); }
        .btn-xs { padding: 2px 6px; font-size: 0.65rem; font-weight: 700; }
        .divider-lg { height: 1px; background: var(--border); margin: 0.5rem 0; }
        .empty-state-card { padding: 2rem; background: var(--bg-surface); border: 2px dashed var(--border-subtle); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--text-tertiary); }
        .spin { animation: spin 1s linear infinite; }

        /* Phase 3 — Samples drawer */
        .drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; }
        .samples-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(480px, 100vw); background: var(--bg-surface); border-left: 1px solid var(--border-subtle); z-index: 201; display: flex; flex-direction: column; overflow: hidden; }
        .drawer-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .drawer-title { font-family: var(--font-display); font-size: 1.1rem; font-weight: 800; color: var(--white); margin: 0; }
        .drawer-sub { font-size: 0.75rem; color: var(--white-40); margin: 0.25rem 0 0; }
        .drawer-tabs { display: flex; border-bottom: 1px solid var(--border-subtle); }
        .drawer-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.65rem; font-family: var(--font-data); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: none; border: none; color: var(--white-30); cursor: pointer; border-bottom: 2px solid transparent; }
        .drawer-tab.active { color: var(--logic-lime); border-bottom-color: var(--logic-lime); }
        .drawer-body { flex: 1; overflow-y: auto; padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .sample-card { background: var(--bg-inset); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem 1rem; }
        .sample-card-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .sample-title { font-family: var(--font-display); font-size: 0.9rem; font-weight: 700; color: var(--white); }
        .sample-preview-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
        .sample-preview-item { font-size: 0.75rem; color: var(--white-40); line-height: 1.4; padding-left: 0.75rem; position: relative; }
        .sample-preview-item::before { content: '·'; position: absolute; left: 0; color: var(--white-20); }
        .sample-preview-more { font-size: 0.7rem; color: var(--white-20); font-style: italic; padding-left: 0.75rem; }
        .drawer-resources-note { font-size: 0.75rem; color: var(--white-40); background: var(--bg-inset); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; }

        @media (max-width: 720px) {
          .single-column-layout { gap: 2.5rem; padding-bottom: 3rem; }
          .section-header { align-items: stretch; flex-direction: column; }
          .section-header-actions { flex-wrap: wrap; }
          .rules-stack--grid { grid-template-columns: 1fr; }
          .resource-list-stack--grid { grid-template-columns: 1fr; }
          .add-form { flex-direction: column; width: 100%; }
          .add-form .form-input { max-width: none; width: 100%; }
          .add-form .btn { justify-content: center; min-height: 44px; width: 100%; }
          .rule-card-header { align-items: flex-start; gap: 0.75rem; padding: 0.85rem; }
          .rule-card-title-group { align-items: flex-start; flex-direction: column; gap: 0.65rem; min-width: 0; }
          .rule-items-list { padding: 0.85rem; }
          .rule-item-row { gap: 0.5rem; }
          .applies-to-row { align-items: flex-start; flex-direction: column; padding: 0.75rem 0.85rem; }
          .resource-header { align-items: flex-start; }
          .resource-actions { flex-wrap: wrap; justify-content: flex-end; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
