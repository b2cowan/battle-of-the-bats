'use client';
import { useState, useEffect } from 'react';
import { 
  BookOpen, FileText, Shield, AlertCircle, CheckCircle, 
  Plus, Trash2, GripVertical, Download, Upload, 
  RefreshCw, ChevronDown, ChevronUp, Link as LinkIcon,
  HelpCircle, Info, X, Check, ExternalLink, Pencil
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

import { Tournament, RuleSection, RuleItem, Resource } from '@/lib/types';
import { 
  getRules, saveRuleSection, updateRuleSection, deleteRuleSection,
  saveRuleItem, updateRuleItem, deleteRuleItem,
  getResources, saveResource, updateResource, deleteResource,
  uploadResourceFile, seedRulesAndResources
} from '@/lib/db';
import styles from '../admin-common.module.css';

interface Props {
  tournament: Tournament;
}

const ICONS = [
  { name: 'Shield', Icon: Shield },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'AlertCircle', Icon: AlertCircle },
  { name: 'CheckCircle', Icon: CheckCircle },
  { name: 'Info', Icon: Info },
  { name: 'HelpCircle', Icon: HelpCircle },
];

// --- Sortable Item Component ---
function SortableResource({ 
  res, 
  editingResourceId, 
  startEditingResource, 
  handleDeleteResource,
  editingResourceLabel,
  setEditingResourceLabel,
  editingResourceUrl,
  setEditingResourceUrl,
  saveResourceEdit,
  setEditingResourceId
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: res.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`resource-edit-card ${isDragging ? 'dragging' : ''}`}>
      {editingResourceId === res.id ? (
        <div className="resource-edit-form">
          <div className="flex gap-4">
            <div className="form-group flex-1">
              <label className="tiny-label">Display Name</label>
              <input 
                autoFocus
                className="form-input sm"
                value={editingResourceLabel}
                onChange={e => setEditingResourceLabel(e.target.value)}
              />
            </div>
            <div className="form-group flex-1">
              <label className="tiny-label">URL / Path</label>
              <input 
                className="form-input sm"
                value={editingResourceUrl}
                onChange={e => setEditingResourceUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button className="btn btn-purple btn-xs" onClick={saveResourceEdit}><Check size={12} /> Save</button>
            <button className="btn btn-outline btn-xs" onClick={() => setEditingResourceId(null)}><X size={12} /> Cancel</button>
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
          <div className="drag-handle-right" {...attributes} {...listeners}>
            <GripVertical size={18} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RulesAdmin({ tournament }: Props) {
  const [rules, setRules] = useState<RuleSection[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Edit states
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingResourceLabel, setEditingResourceLabel] = useState('');
  const [editingResourceUrl, setEditingResourceUrl] = useState('');

  // Form states
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tournament.id]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const r = await getRules(tournament.id);
      const res = await getResources(tournament.id);
      setRules(r);
      setResources(res);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  }

  // --- Rule Section Actions ---
  async function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    try {
      setSaving(true);
      const id = await saveRuleSection({
        tournamentId: tournament.id,
        title: newSectionTitle,
        icon: 'Shield',
        order: rules.length
      });
      if (!id) throw new Error('Failed to save');
      setNewSectionTitle('');
      await fetchData();
    } catch (err) {
      alert('Error adding section.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSection(id: string) {
    if (!confirm('Are you sure you want to delete this section and all its rules?')) return;
    try {
      setSaving(true);
      await deleteRuleSection(id);
      await fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed.');
    } finally {
      setSaving(false);
    }
  }

  async function startEditingSection(section: RuleSection) {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  }

  async function saveSectionTitle() {
    if (!editingSectionId) return;
    await updateRuleSection(editingSectionId, { title: editingSectionTitle });
    setRules(prev => prev.map(s => s.id === editingSectionId ? { ...s, title: editingSectionTitle } : s));
    setEditingSectionId(null);
  }

  async function handleUpdateSectionIcon(id: string, icon: string) {
    await updateRuleSection(id, { icon });
    setRules(prev => prev.map(s => s.id === id ? { ...s, icon } : s));
  }

  // --- Rule Item Actions ---
  async function handleAddItem(ruleId: string) {
    const section = rules.find(s => s.id === ruleId);
    if (!section) return;
    
    await saveRuleItem({
      ruleId,
      content: 'New rule point...',
      order: section.items.length
    });
    await fetchData();
  }

  async function handleUpdateItem(id: string, content: string) {
    await updateRuleItem(id, { content });
    setRules(prev => prev.map(s => ({
      ...s,
      items: s.items.map(i => i.id === id ? { ...i, content } : i)
    })));
  }

  async function handleDeleteItem(id: string) {
    await deleteRuleItem(id);
    await fetchData();
  }

  // --- Resource Actions ---
  async function handleAddResource() {
    setSaving(true);
    await saveResource({
      tournamentId: tournament.id,
      label: 'New Link',
      url: 'https://',
      order: resources.length
    });
    await fetchData();
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadResourceFile(file);
      if (url) {
        await saveResource({
          tournamentId: tournament.id,
          label: file.name,
          url: url,
          order: resources.length
        });
        await fetchData();
      }
    } catch (err) {
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function startEditingResource(res: Resource) {
    setEditingResourceId(res.id);
    setEditingResourceLabel(res.label);
    setEditingResourceUrl(res.url);
  }

  async function saveResourceEdit() {
    if (!editingResourceId) return;
    await updateResource(editingResourceId, { 
      label: editingResourceLabel, 
      url: editingResourceUrl 
    });
    setResources(prev => prev.map(r => r.id === editingResourceId ? { 
      ...r, 
      label: editingResourceLabel,
      url: editingResourceUrl
    } : r));
    setEditingResourceId(null);
  }

  async function handleDeleteResource(id: string) {
    if (!confirm('Delete this resource? This will also remove the file from the database and storage.')) return;
    try {
      setSaving(true);
      await deleteResource(id);
      await fetchData();
    } catch (err) {
      console.error('Delete resource error:', err);
      alert('Delete failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = resources.findIndex((r) => r.id === active.id);
      const newIndex = resources.findIndex((r) => r.id === over.id);
      
      const newArray = arrayMove(resources, oldIndex, newIndex);
      setResources(newArray);

      // Persist to DB
      try {
        setSaving(true);
        for (let i = 0; i < newArray.length; i++) {
          if (newArray[i].display_order !== i) {
            await updateResource(newArray[i].id, { order: i });
          }
        }
      } catch (err) {
        console.error('Failed to save order', err);
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleSeed() {
    if (!confirm('This will seed the rules with the default set. Continue?')) return;
    setLoading(true);
    try {
      await seedRulesAndResources(tournament.id);
      await fetchData();
    } catch (err) {
      alert('Seeding failed.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className="flex-center" style={{ height: '400px' }}>
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="spin text-purple-light" size={48} />
            <p className="text-white-40 font-bold tracking-widest uppercase text-xs">Loading Rules...</p>
          </div>
        </div>
      </div>
    );
  }

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
          <button className="btn btn-purple btn-sm" onClick={handleSeed}>
            <RefreshCw size={14} /> Seed Default Data
          </button>
        </div>
      </header>

      {error && (
        <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', marginBottom: '2rem' }}>
          <div className="flex gap-3 items-center text-danger">
            <AlertCircle size={20} />
            <p style={{ fontWeight: 600 }}>{error}</p>
          </div>
        </div>
      )}

      <div className="single-column-layout">
        
        {/* Rules Sections */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Tournament Rules</h2>
            <div className="add-form">
              <input 
                type="text" 
                className="form-input" 
                placeholder="New section title..." 
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
              />
              <button className="btn btn-purple" onClick={handleAddSection} disabled={saving}>
                <Plus size={16} /> Add Section
              </button>
            </div>
          </div>

          <div className="rules-stack">
            {rules.map(section => (
              <div key={section.id} className="rule-card">
                <div className="rule-card-header">
                  <div className="rule-card-title-group">
                    <div className="icon-preview-box">
                      {(() => {
                        const IconObj = ICONS.find(i => i.name === (section.icon || 'Shield'))?.Icon || Shield;
                        return <IconObj size={20} />;
                      })()}
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
                        />
                        <button className="icon-btn-success" onClick={saveSectionTitle}><Check size={16} /></button>
                        <button className="icon-btn-ghost" onClick={() => setEditingSectionId(null)}><X size={16} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-1 items-center group">
                        <h3 className="card-title-text">{section.title}</h3>
                        <button className="edit-pencil-btn" onClick={() => startEditingSection(section)}>
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="delete-btn-mini" onClick={() => handleDeleteSection(section.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>

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
              </div>
            ))}
          </div>
        </section>

        <div className="divider-lg" />

        {/* Resources Section */}
        <section className="content-section">
          <div className="section-header">
            <h2 className="section-title">Resources & Downloads</h2>
            <div className="add-form">
              <button className="btn btn-outline" onClick={handleAddResource}><LinkIcon size={14} /> Add Link</button>
              <button className="btn btn-purple" onClick={() => document.getElementById('file-up-main')?.click()}><Upload size={14} /> Upload File</button>
              <input type="file" id="file-up-main" hidden onChange={handleFileUpload} />
            </div>
          </div>
          
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="resource-list-stack">
              <SortableContext 
                items={resources.map(r => r.id)}
                strategy={verticalListSortingStrategy}
              >
                {resources.map((res) => (
                  <SortableResource 
                    key={res.id} 
                    res={res}
                    editingResourceId={editingResourceId}
                    startEditingResource={startEditingResource}
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

      <style jsx global>{`
        .single-column-layout { display: flex; flex-direction: column; gap: 4rem; padding-bottom: 5rem; }
        .content-section { display: flex; flex-direction: column; gap: 1.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
        .section-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--white); margin: 0; }
        .add-form { display: flex; gap: 0.75rem; }
        .add-form .form-input { max-width: 300px; height: 38px; }

        .rules-stack { display: flex; flex-direction: column; gap: 1.5rem; }
        .rule-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; }
        .rule-card-header { padding: 0.75rem 1.25rem; background: var(--white-05); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .rule-card-title-group { display: flex; align-items: center; gap: 1rem; flex: 1; }
        .icon-preview-box {
          width: 32px;
          height: 32px;
          background: var(--purple-faint);
          border: 1px solid var(--border);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--purple-light);
          flex-shrink: 0;
        }
        .icon-select { background: var(--bg-3); border: 1px solid var(--border); color: var(--white); border-radius: 6px; padding: 2px 6px; font-size: 0.8rem; }
        
        .card-title-text { font-family: var(--font-display); font-size: 1rem; font-weight: 800; color: var(--white); margin: 0; }
        .inline-title-input { background: var(--black-20); border: 1px solid var(--purple); outline: none; color: var(--white); font-family: var(--font-display); font-size: 1rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; width: 100%; }

        .edit-pencil-btn { background: none; border: none; color: var(--white-20); cursor: pointer; padding: 4px; opacity: 0; transition: opacity 0.2s; }
        .group:hover .edit-pencil-btn { opacity: 1; }
        .edit-pencil-btn:hover { color: var(--purple-light); }

        .delete-btn-mini { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 6px; transition: color 0.2s; }
        .delete-btn-mini:hover { color: var(--danger); }

        .rule-items-list { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .rule-item-row { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.3rem; border-radius: 6px; }
        .rule-item-row:hover { background: var(--white-05); }
        .drag-handle { margin-top: 6px; color: var(--white-10); }
        .item-textarea { flex: 1; background: transparent; border: none; outline: none; color: var(--white-80); font-size: 0.9rem; line-height: 1.5; resize: none; padding: 0; }
        .item-delete-btn { background: none; border: none; color: var(--white-10); cursor: pointer; opacity: 0; }
        .rule-item-row:hover .item-delete-btn { opacity: 1; color: var(--danger); }
        .add-item-btn { align-self: flex-start; background: none; border: 1px dashed var(--border); color: var(--white-40); font-size: 0.7rem; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 99px; cursor: pointer; margin-top: 0.4rem; }

        .resource-list-stack { display: flex; flex-direction: column; gap: 0.5rem; }
        .resource-edit-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.6rem; padding: 0.5rem 0.75rem; transition: transform 0.1s; }
        .resource-edit-card.dragging { background: var(--bg-3); border-color: var(--purple); }
        
        .resource-header { display: flex; align-items: center; gap: 0.75rem; }
        
        .resource-icon-box { width: 30px; height: 30px; background: var(--white-05); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--purple-light); flex-shrink: 0; }
        .resource-meta { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .resource-display-label { color: var(--white); font-weight: 700; font-size: 0.9rem; }
        .resource-display-url { color: var(--white-20); font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .resource-edit-form { display: flex; flex-direction: column; gap: 0.5rem; }
        .tiny-label { font-size: 0.6rem; font-weight: 800; color: var(--white-20); text-transform: uppercase; margin-bottom: -0.3rem; }
        .form-input.sm { padding: 3px 6px; font-size: 0.8rem; background: var(--black-20); }

        .resource-actions { display: flex; align-items: center; gap: 0.1rem; flex-shrink: 0; position: relative; z-index: 20; }
        
        .drag-handle-right { 
          color: var(--white-10); 
          cursor: grab; 
          padding: 8px; 
          margin-right: -4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .drag-handle-right:active { cursor: grabbing; color: var(--purple-light); }
        .resource-edit-card:hover .drag-handle-right { color: var(--white-30); }

        .icon-btn-ghost { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .icon-btn-ghost:hover { background: var(--white-10); color: var(--white); }
        .icon-btn-success { background: var(--success); color: var(--white); border: none; padding: 4px; border-radius: 4px; cursor: pointer; }
        .icon-btn-danger { background: none; border: none; color: var(--white-10); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .icon-btn-danger:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

        .btn-xs { padding: 2px 6px; font-size: 0.65rem; font-weight: 700; }
        .divider-lg { height: 1px; background: var(--border); margin: 0.5rem 0; }
        .empty-state-card { padding: 2rem; background: var(--bg-card); border: 2px dashed var(--border); border-radius: 1rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--white-20); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
