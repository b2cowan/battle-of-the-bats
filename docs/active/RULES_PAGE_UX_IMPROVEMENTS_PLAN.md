# Rules & Resources — UX Improvements Plan

> **Status:** Implemented — awaiting browser verification  
> **Created:** 2026-05-24  
> **Implemented:** 2026-05-25  
> **Branch:** dev  
> **PM Brief:** `RULES_PAGE_UX_IMPROVEMENTS_PM_BRIEF.md`

---

## Goals

1. [x] Replace browser `confirm()` dialogs with platform-native confirmation modals
2. [x] Replace the pre-type-then-click add-section flow with an inline blank-card pattern
3. [x] Replace destructive "Seed Default Data" with an additive "Browse Samples" drawer
4. [x] Suppress empty sections on the public rules page (already partially done for resources)

---

## Architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Samples: additive vs. replace | **Additive only** | Existing content is always preserved; samples are appended |
| Add section title | **Required before save** | Card stays open with disabled confirm until title is non-empty; no orphan untitled sections |
| Samples data | **Hardcoded const** in `rules-samples.ts` | Simple to maintain; no DB dependency for samples content |

---

## Phase 1 — Custom confirmation modals ✅

**Files:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`

Replace all three `window.confirm()` calls with in-shell modals.

### New state variables (add alongside existing state)
```tsx
const [deleteConfirmSectionId, setDeleteConfirmSectionId] = useState<string | null>(null);
const [deleteConfirmResourceId, setDeleteConfirmResourceId] = useState<string | null>(null);
const [showSeedConfirm, setShowSeedConfirm] = useState(false);
```

### Handler changes
- `handleDeleteSection(id)` → set `deleteConfirmSectionId = id` (don't call `deleteRuleSection` yet)
- `handleDeleteResource(id)` → set `deleteConfirmResourceId = id`
- `handleSeed()` → set `showSeedConfirm = true`

### New confirm modal versions of the actual mutations
```tsx
async function confirmDeleteSection() {
  if (!deleteConfirmSectionId) return;
  setSaving(true);
  try { await deleteRuleSection(deleteConfirmSectionId); await fetchData(); }
  catch { alert('Delete failed.'); }
  finally { setSaving(false); setDeleteConfirmSectionId(null); }
}

async function confirmDeleteResource() {
  if (!deleteConfirmResourceId) return;
  setSaving(true);
  try { await deleteResource(deleteConfirmResourceId); await fetchData(); }
  catch { alert('Delete failed.'); }
  finally { setSaving(false); setDeleteConfirmResourceId(null); }
}

async function confirmSeed() {
  setLoading(true);
  setShowSeedConfirm(false);
  try { await seedRulesAndResources(tournament.id); await fetchData(); }
  catch { alert('Seeding failed.'); }
  finally { setLoading(false); }
}
```

### Three modals to add at the bottom of the JSX (before nav warning modal)

**Delete section modal** — trigger: `deleteConfirmSectionId !== null`  
Title: "Delete Section?"  
Body: "This will permanently remove this section and all its rule points."  
Actions: ghost "Cancel" | danger "Delete Section"

**Delete resource modal** — trigger: `deleteConfirmResourceId !== null`  
Title: "Delete Resource?"  
Body: "This will remove this link or file from the public Rules page."  
Actions: ghost "Cancel" | danger "Delete Resource"

**Seed confirm modal** — trigger: `showSeedConfirm`  
> Note: This modal is a temporary bridge while Browse Samples (Phase 3) is built. Once Phase 3 ships, remove the seed button and this modal entirely.  
Title: "Load Default Rules?"  
Body: "This will add a set of sample rule sections to your existing rules. Your current content will not be removed."  
Actions: ghost "Cancel" | lime "Load Samples"

---

## Phase 2 — Inline add-section flow ✅

**Files:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`

### Remove
- `newSectionTitle` state
- The `<input>` and old Add Section button from `.section-header .add-form`
- `onKeyDown` Enter handler on the old input

### Add
```tsx
const [showNewSectionCard, setShowNewSectionCard]       = useState(false);
const [newSectionTitleInline, setNewSectionTitleInline] = useState('');
```

### Section header change
Replace the `add-form` div contents with a single button:
```tsx
<button className="btn btn-lime btn-data" onClick={() => { setShowNewSectionCard(true); setNewSectionTitleInline(''); }}>
  <Plus size={14} /> Add Section
</button>
```

### Inline blank card (render at end of `.rules-stack` when `showNewSectionCard`)
```tsx
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
```

### Updated `handleAddSection` (rename to `handleAddInlineSection`)
```tsx
async function handleAddInlineSection() {
  if (!newSectionTitleInline.trim()) return;
  setSaving(true);
  try {
    await saveRuleSection({ tournamentId: tournament.id, title: newSectionTitleInline.trim(), icon: 'Shield', order: rules.length });
    setShowNewSectionCard(false);
    setNewSectionTitleInline('');
    await fetchData();
  } catch { alert('Error adding section.'); }
  finally { setSaving(false); }
}
```

### CSS to add in the `<style jsx global>` block
```css
.new-section-card { border-style: dashed; border-color: var(--logic-lime); opacity: 0.85; }
.icon-btn-success:disabled { opacity: 0.3; cursor: not-allowed; }
```

---

## Phase 3 — Browse Samples drawer ✅

**New files:**
- `app/[orgSlug]/admin/tournaments/rules/rules-samples.ts` — curated sample data
- `app/[orgSlug]/admin/tournaments/rules/SamplesDrawer.tsx` — drawer component

**Files to update:**
- `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` — swap Seed button for Browse Samples

### `rules-samples.ts` — sample data

```ts
export interface SampleSection {
  title: string;
  icon: string;
  items: string[];
}

export interface SampleResource {
  label: string;
  url: string; // empty string = placeholder; user must fill in before publishing
}

export const SAMPLE_RULE_SECTIONS: SampleSection[] = [
  {
    title: 'General Rules',
    icon: 'Shield',
    items: [
      'All participants must comply with the rules of the game as defined by the governing body.',
      'Teams are responsible for the behaviour of their players, coaches, and spectators.',
      'The tournament director\'s decisions are final.',
    ],
  },
  {
    title: 'Game Play',
    icon: 'CheckCircle',
    items: [
      'Games will start at the scheduled time. Teams must be ready 10 minutes before game time.',
      'A minimum of [X] players constitutes a legal lineup. Fewer players results in a forfeit.',
      'Mercy rule: a game is called when a team leads by [X] runs after [X] innings.',
    ],
  },
  {
    title: 'Tie-Breaker Procedures',
    icon: 'AlertCircle',
    items: [
      'In the event of a tie in the standings, the following criteria apply in order: (1) head-to-head record, (2) run differential (capped at +/- [X] per game), (3) coin toss.',
    ],
  },
  {
    title: 'Code of Conduct',
    icon: 'BookOpen',
    items: [
      'Unsportsmanlike conduct — including arguing with officials, excessive appealing, or disrespectful language — will result in a warning, then ejection.',
      'Ejected players must leave the playing area immediately and are suspended for the next scheduled game.',
    ],
  },
];

export const SAMPLE_RESOURCES: SampleResource[] = [
  { label: 'Tournament Schedule (PDF)', url: '' },
  { label: 'Official Rulebook', url: '' },
  { label: 'Team Contact Sheet', url: '' },
];
```

### `SamplesDrawer.tsx` component

```tsx
'use client';
import { useState } from 'react';
import { X, BookOpen, FileText, Plus } from 'lucide-react';
import { SAMPLE_RULE_SECTIONS, SAMPLE_RESOURCES, SampleSection, SampleResource } from './rules-samples';

interface Props {
  onAddSection: (sample: SampleSection) => Promise<void>;
  onAddResource: (sample: SampleResource) => Promise<void>;
  onClose: () => void;
  adding: string | null; // id of sample currently being added
}

export default function SamplesDrawer({ onAddSection, onAddResource, onClose, adding }: Props) {
  const [tab, setTab] = useState<'rules' | 'resources'>('rules');

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="samples-drawer">
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Sample Rules & Resources</h2>
            <p className="drawer-sub">Pick any sample to add it to your content. Your existing rules are never removed.</p>
          </div>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /> Close</button>
        </div>

        <div className="drawer-tabs">
          <button className={`drawer-tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>
            <BookOpen size={14} /> Rule Sections
          </button>
          <button className={`drawer-tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => setTab('resources')}>
            <FileText size={14} /> Resources
          </button>
        </div>

        <div className="drawer-body">
          {tab === 'rules' && SAMPLE_RULE_SECTIONS.map((s, i) => (
            <div key={i} className="sample-card">
              <div className="sample-card-header">
                <strong className="sample-title">{s.title}</strong>
                <button
                  className="btn btn-lime btn-data"
                  onClick={() => onAddSection(s)}
                  disabled={adding === `section-${i}`}
                >
                  <Plus size={12} /> {adding === `section-${i}` ? 'Adding…' : 'Add'}
                </button>
              </div>
              <ul className="sample-preview-list">
                {s.items.slice(0, 2).map((item, j) => (
                  <li key={j} className="sample-preview-item">{item}</li>
                ))}
                {s.items.length > 2 && <li className="sample-preview-more">+{s.items.length - 2} more rule points…</li>}
              </ul>
            </div>
          ))}

          {tab === 'resources' && (
            <>
              <p className="drawer-resources-note">Sample resources are placeholder links. After adding, click the edit (pencil) icon to update the URL or upload a file.</p>
              {SAMPLE_RESOURCES.map((r, i) => (
                <div key={i} className="sample-card">
                  <div className="sample-card-header">
                    <strong className="sample-title">{r.label}</strong>
                    <button
                      className="btn btn-lime btn-data"
                      onClick={() => onAddResource(r)}
                      disabled={adding === `resource-${i}`}
                    >
                      <Plus size={12} /> {adding === `resource-${i}` ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

### CSS additions to `RulesAdmin.tsx` global style block (or extract to module)

```css
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
```

### RulesAdmin changes to wire in SamplesDrawer

Add state:
```tsx
const [showSamples, setShowSamples] = useState(false);
const [addingSample, setAddingSample] = useState<string | null>(null);
```

Add handlers:
```tsx
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
```

Replace "Seed Default Data" button:
```tsx
<button className="btn btn-outline btn-data" onClick={() => setShowSamples(true)}>
  <BookOpen size={14} /> Browse Samples
</button>
```

Add SamplesDrawer at the bottom of the return JSX:
```tsx
{showSamples && (
  <SamplesDrawer
    onAddSection={(s, i) => handleAddSampleSection(s, i)}
    onAddResource={(r, i) => handleAddSampleResource(r, i)}
    onClose={() => setShowSamples(false)}
    adding={addingSample}
  />
)}
```

Once Phase 3 ships: remove `seedRulesAndResources` import and the seed confirm modal from Phase 1.

---

## Phase 4 — Public page section suppression ✅

**File:** `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`

### Current behaviour
- Rules: falls back to `FALLBACK_RULES` (shows "Rules Coming Soon" card) when empty
- Resources: already suppressed when empty ✓

### Target behaviour
- If `allRules.length === 0` AND `resources.length === 0` → entire page body shows a single "Content coming soon" card; no fake rule sections
- If `allRules.length === 0` AND `resources.length > 0` → suppress rules grid, show resources only
- If `allRules.length > 0` AND `resources.length === 0` → show rules, suppress resources ✓ (already done)

### Implementation

Remove `FALLBACK_RULES` and `FALLBACK_RESOURCES` constants.

```tsx
const hasRules     = allRules.length > 0;
const hasResources = resources.length > 0;
const hasContent   = hasRules || hasResources;

const displayRules = isFiltering
  ? allRules.filter(r => !r.ageGroupIds?.length || r.ageGroupIds.includes(preferredGroup!.id))
  : allRules;
```

Render logic:
```tsx
{!hasContent && (
  <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
    <BookOpen size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
    <p className="text-muted">Rules and resources for this tournament haven't been published yet. Check back before game day.</p>
  </div>
)}

{hasRules && (
  <div className={styles.rulesGrid}>
    {displayRules.map(section => { /* existing render */ })}
  </div>
)}

{hasResources && (
  /* existing resources card — unchanged */
)}
```

Also remove the disclaimer card ("These rules are subject to change…") when `!hasContent`, since there's nothing to disclaim yet.

---

## Build order

1. Phase 1 — Custom modals (no DB, standalone)
2. Phase 4 — Public page suppression (no DB, standalone)
3. Phase 2 — Inline add-section (no DB, standalone)
4. Phase 3 — Browse Samples (largest; depends on Phase 2 UX being stable)

---

## Files touched summary

| Phase | Files |
|---|---|
| 1 | `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` |
| 2 | `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` |
| 3 | `app/[orgSlug]/admin/tournaments/rules/rules-samples.ts` *(new)*, `SamplesDrawer.tsx` *(new)*, `RulesAdmin.tsx` |
| 4 | `app/[orgSlug]/[tournamentSlug]/rules/page.tsx` |
