'use client';
import { useState } from 'react';
import { X, BookOpen, FileText, Plus } from 'lucide-react';
import { SAMPLE_RULE_SECTIONS, SAMPLE_RESOURCES, SampleSection, SampleResource } from './rules-samples';

interface Props {
  onAddSection: (sample: SampleSection, index: number) => Promise<void>;
  onAddResource: (sample: SampleResource, index: number) => Promise<void>;
  onClose: () => void;
  adding: string | null; // id of sample currently being added, e.g. "section-0" or "resource-1"
}

export default function SamplesDrawer({ onAddSection, onAddResource, onClose, adding }: Props) {
  const [tab, setTab] = useState<'rules' | 'resources'>('rules');

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="samples-drawer">
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Sample Rules &amp; Resources</h2>
            <p className="drawer-sub">Pick any sample to add it to your content. Your existing rules are never removed.</p>
          </div>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /> Close</button>
        </div>

        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${tab === 'rules' ? 'active' : ''}`}
            onClick={() => setTab('rules')}
          >
            <BookOpen size={14} /> Rule Sections
          </button>
          <button
            className={`drawer-tab ${tab === 'resources' ? 'active' : ''}`}
            onClick={() => setTab('resources')}
          >
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
                  onClick={() => onAddSection(s, i)}
                  disabled={adding === `section-${i}`}
                >
                  <Plus size={12} /> {adding === `section-${i}` ? 'Adding…' : 'Add'}
                </button>
              </div>
              <ul className="sample-preview-list">
                {s.items.slice(0, 2).map((item, j) => (
                  <li key={j} className="sample-preview-item">{item}</li>
                ))}
                {s.items.length > 2 && (
                  <li className="sample-preview-more">+{s.items.length - 2} more rule points…</li>
                )}
              </ul>
            </div>
          ))}

          {tab === 'resources' && (
            <>
              <p className="drawer-resources-note">
                Sample resources are placeholder links. After adding, click the edit (pencil) icon to update the URL or upload a file.
              </p>
              {SAMPLE_RESOURCES.map((r, i) => (
                <div key={i} className="sample-card">
                  <div className="sample-card-header">
                    <strong className="sample-title">{r.label}</strong>
                    <button
                      className="btn btn-lime btn-data"
                      onClick={() => onAddResource(r, i)}
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
