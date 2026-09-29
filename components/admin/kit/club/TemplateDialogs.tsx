'use client';
/**
 * DOCUMENT TEMPLATES — THE WINDOWS (Club Tier Stage 2, specimen 8; J4-009, B11).
 *
 *   TemplateDialog   — the row's chevron opens the template: Download, Switch off / on, and Delete
 *                      (which asks, as today). "Applies to" can be changed here too — the server
 *                      checks the team is one of the club's (session 1).
 *                      ⚠ Departure, told at build time: the drawing names only the three actions; the
 *                      editable "Applies to" is the server's own B11 edit, given its one home.
 *   UploadTemplateDialog — Name, Type, "Applies to" (a dropdown of the club's teams, grouped as on
 *                      Rep Teams, with "Every team" first — no more raw team-id box), and the file.
 *                      Creating asks: an explicit Upload.
 */
import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { repKit } from './RepKit';
import { formatStoredDate } from '@/lib/timezone';
import type { RepDocumentType } from '@/lib/types';

export const DOC_TYPE_LABEL: Record<RepDocumentType, string> = {
  waiver: 'Waiver', medical_consent: 'Medical consent', code_of_conduct: 'Code of conduct', other: 'Other',
};
export const DOC_TYPES = Object.keys(DOC_TYPE_LABEL) as RepDocumentType[];

export interface TemplateRow {
  id: string; teamId: string | null; name: string; documentType: RepDocumentType;
  fileName: string; fileSize: number; isActive: boolean; createdAt: string;
}
export interface PickerTeam { id: string; name: string; groupId: string | null; groupName: string | null; isArchived?: boolean }

const EVERY_TEAM = '';

/** The "Applies to" dropdown: Every team first, then the club's teams grouped as on Rep Teams. */
function AppliesToSelect({ value, teams, onChange, disabled }: {
  value: string; teams: PickerTeam[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  // An archived team is offered only when it is the one already chosen: a template made for it
  // must still say so (the select would otherwise fall back to "Every team" and misstate its reach).
  const offered = teams.filter(t => !t.isArchived || t.id === value);
  const groups = new Map<string, PickerTeam[]>();
  for (const t of [...offered].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = t.groupName ?? 'Ungrouped';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const grouped = groups.size > 1 || (groups.size === 1 && !groups.has('Ungrouped'));
  return (
    <select className={ck.select} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
      <option value={EVERY_TEAM}>Every team</option>
      {grouped
        ? [...groups.entries()].map(([label, list]) => (
            <optgroup key={label} label={label}>{list.map(t => <option key={t.id} value={t.id}>{pickerLabel(t)}</option>)}</optgroup>
          ))
        : offered.map(t => <option key={t.id} value={t.id}>{pickerLabel(t)}</option>)}
    </select>
  );
}

function pickerLabel(t: PickerTeam): string {
  return t.isArchived ? `${t.name} (archived)` : t.name;
}

function appliesHint(teamId: string, teams: PickerTeam[]): string {
  if (!teamId) return 'Every team’s families see it.';
  return `Only ${teams.find(t => t.id === teamId)?.name ?? 'that team'}’s families see it.`;
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TemplateDialog({
  template, teams, canWrite, busy, onClose, onDownload, onPatch, onDelete,
}: {
  template: TemplateRow;
  teams: PickerTeam[];
  canWrite: boolean;
  busy: boolean;
  onClose: () => void;
  onDownload: () => void;
  onPatch: (body: { isActive?: boolean; teamId?: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <KitDialog
        kind="question"
        title={`Delete ${template.name}?`}
        onClose={() => setAsking(false)}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
            <button type="button" className="btn btn-danger" onClick={() => void onDelete()} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button>
          </>
        }
      >
        <p>This can’t be undone. The file is removed and families stop seeing it. Copies families have already signed stay on their records.</p>
      </KitDialog>
    );
  }

  return (
    <KitDialog
      kind="form"
      eyebrow="Document template"
      title={template.name}
      identity={`${DOC_TYPE_LABEL[template.documentType] ?? template.documentType} · added ${formatStoredDate(template.createdAt)}`}
      onClose={onClose}
      busy={busy}
      footerStart={canWrite ? <button type="button" className="btn btn-danger" onClick={() => setAsking(true)} disabled={busy}>Delete</button> : undefined}
      footer={
        <>
          {canWrite && (
            <button type="button" className="btn btn-outline" onClick={() => void onPatch({ isActive: !template.isActive })} disabled={busy}>
              {template.isActive ? 'Switch off' : 'Switch on'}
            </button>
          )}
          <button type="button" className="btn btn-lime" onClick={onDownload} disabled={busy}>
            <Download size={14} aria-hidden /> Download
          </button>
        </>
      }
    >
      <label className={ck.field}>
        <span className={ck.label}>Applies to</span>
        <AppliesToSelect
          value={template.teamId ?? EVERY_TEAM}
          teams={teams}
          disabled={!canWrite || busy}
          onChange={v => void onPatch({ teamId: v || null })}
        />
        <span className={ck.hint}>{appliesHint(template.teamId ?? '', teams)}</span>
      </label>
      <div className={repKit.facts}>
        <span className={repKit.factsLabel}>File</span>
        {template.fileName} · {bytes(template.fileSize)}
      </div>
      <div className={`${repKit.facts} ${repKit.factsNext}`}>
        <span className={repKit.factsLabel}>Status</span>
        {template.isActive
          ? 'On — families see it and sign it each season.'
          : 'Off — families don’t see it, and it doesn’t count on the Rep Teams board.'}
      </div>
    </KitDialog>
  );
}

export function UploadTemplateDialog({
  orgSlug, teams, onClose, onUploaded,
}: {
  orgSlug: string;
  teams: PickerTeam[];
  onClose: () => void;
  onUploaded: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RepDocumentType | ''>('');
  const [teamId, setTeamId] = useState(EVERY_TEAM);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const ready = !!name.trim() && !!type && !!file;

  async function upload() {
    if (!ready || busy || !file || !type) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name.trim());
      form.append('documentType', type);
      if (teamId) form.append('teamId', teamId);
      const res = await fetch(`/api/admin/rep-teams/document-templates?orgSlug=${encodeURIComponent(orgSlug)}`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'The template could not be uploaded.'); return; }
      onUploaded(name.trim());
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title="Upload a template"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={upload} disabled={!ready || busy}>{busy ? 'Uploading…' : 'Upload'}</button>
        </>
      }
    >
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <label className={ck.field}>
        <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
        <input className={ck.input} value={name} maxLength={120} placeholder="e.g. Participant waiver 2027" onChange={e => setName(e.target.value)} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Type<span className={repKit.req} aria-hidden>*</span></span>
        <select className={ck.select} value={type} onChange={e => setType(e.target.value as RepDocumentType)}>
          <option value="">Choose a type</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <label className={ck.field}>
        <span className={ck.label}>Applies to<span className={repKit.req} aria-hidden>*</span></span>
        <AppliesToSelect value={teamId} teams={teams} onChange={setTeamId} />
        <span className={ck.hint}>{appliesHint(teamId, teams)}</span>
      </label>
      <label className={ck.field}>
        <span className={ck.label}>File<span className={repKit.req} aria-hidden>*</span></span>
        <input ref={fileRef} className={ck.input} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <span className={ck.hint}>PDF, JPG, PNG or Word · up to 10 MB</span>
      </label>
    </KitDialog>
  );
}
