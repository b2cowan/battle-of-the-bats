'use client';
/**
 * Rep Teams › Team groups (Club Tier Stage 2, specimen 1: "'Team groups' opens today's groups panel;
 * deleting a group gains a question (S2-04)"). The same three verbs as before — add, rename, delete —
 * in the portal's section shape. Delete ASKS now and says what happens to the group's teams (they
 * stay, Ungrouped): it used to fire on one click.
 */
import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { ClubSection, repKit } from './RepKit';
import { pluralize } from '@/lib/utils';
import type { RepTeamGroup } from '@/lib/types';

type GroupCount = { active: number; archived: number } | undefined;
const totalOf = (c: GroupCount) => (c?.active ?? 0) + (c?.archived ?? 0);
/** "3 teams", or "3 teams · 1 archived" — the first figure is the board's band count. */
const countCaption = (c: GroupCount) =>
  `${pluralize(c?.active ?? 0, 'team')}${c?.archived ? ` · ${c.archived} archived` : ''}`;

export default function TeamGroupsSection({
  orgSlug, groups, teamCounts, onChanged, onClose, onError,
}: {
  orgSlug: string;
  groups: RepTeamGroup[];
  /** Each group's teams, active and archived apart — the caption matches the board's bands, and a
   *  delete is refused while either is non-zero (the server counts archived teams too). */
  teamCounts: Map<string, { active: number; archived: number }>;
  onChanged: (deletedGroupId?: string) => Promise<void>;
  onClose: () => void;
  onError: (text: string) => void;
}) {
  const api = (path = '') => `/api/admin/rep-teams/groups${path}?orgSlug=${encodeURIComponent(orgSlug)}`;
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<RepTeamGroup | null>(null);

  async function send(url: string, init: RequestInit, fail: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error ?? fail);
        return false;
      }
      return true;
    } catch {
      onError('Could not reach the server. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const ok = await send(api(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, displayOrder: groups.length }),
    }, 'The group could not be added.');
    if (ok) { setNewName(''); await onChanged(); }
  }

  async function rename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    const ok = await send(api(`/${id}`), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }, 'The group could not be renamed.');
    if (ok) { setEditingId(null); await onChanged(); }
  }

  async function remove(group: RepTeamGroup) {
    const ok = await send(api(`/${group.id}`), { method: 'DELETE' }, 'The group could not be deleted.');
    setDeleting(null);
    if (ok) await onChanged(group.id);
  }

  return (
    <ClubSection
      id="team-groups"
      title="Team groups"
      meta={pluralize(groups.length, 'group')}
      actions={
        <button type="button" className={`btn btn-ghost ${ck.iconOnlyPhone}`} onClick={onClose} aria-label="Close team groups">
          <X size={15} aria-hidden /><span className={ck.btnWord}>Done</span>
        </button>
      }
      list
    >
      <ul className={repKit.rowListInset} aria-label="Team groups">
        {groups.length === 0 && (
          <li className={repKit.rowItem}>
            <div className={repKit.row}>
              <span className={repKit.rowCaption}>No groups yet. Groups like “Boys” and “Girls”, or “AA” and “A”, sort the board and its filter.</span>
            </div>
          </li>
        )}
        {groups.map(g => (
          <li key={g.id} className={`${repKit.rowItem} ${repKit.rowItemWithActions}`}>
            {editingId === g.id ? (
              <div className={repKit.row}>
                <input
                  className={ck.input}
                  value={editingName}
                  maxLength={50}
                  aria-label={`New name for ${g.name}`}
                  autoFocus
                  onChange={e => setEditingName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void rename(g.id); if (e.key === 'Escape') setEditingId(null); }}
                />
              </div>
            ) : (
              <div className={repKit.row}>
                <span className={repKit.rowMain}>
                  <span className={repKit.rowTitle}>{g.name}</span>
                  <span className={repKit.rowCaption}>{countCaption(teamCounts.get(g.id))}</span>
                </span>
              </div>
            )}
            <span className={repKit.rowActions}>
              {editingId === g.id ? (
                <>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingId(null)} disabled={busy}>Cancel</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void rename(g.id)} disabled={busy || !editingName.trim()}>Save</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(g.id); setEditingName(g.name); }} aria-label={`Rename ${g.name}`} disabled={busy}>
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleting(g)} aria-label={`Delete ${g.name}`} disabled={busy}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form
        className={repKit.groupAdd}
        onSubmit={e => { e.preventDefault(); void add(); }}
      >
        <input
          className={ck.input}
          value={newName}
          maxLength={50}
          placeholder="New group name"
          aria-label="New group name"
          onChange={e => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-outline" disabled={busy || !newName.trim()}>Add group</button>
      </form>

      {/* ⚠ The server refuses to delete a group that still holds a team (archived ones included), so a
          group with teams is TOLD, never asked — a question whose yes is always refused is a trap. */}
      {deleting && totalOf(teamCounts.get(deleting.id)) > 0 && (
        <KitDialog
          kind="question"
          title={`${deleting.name} still holds ${pluralize(totalOf(teamCounts.get(deleting.id)), 'team')}`}
          onClose={() => setDeleting(null)}
          footer={<button type="button" className="btn btn-outline" onClick={() => setDeleting(null)} data-autofocus="">OK</button>}
        >
          <p>Move each one into another group, or none, from its team page’s details first{(teamCounts.get(deleting.id)?.archived ?? 0) > 0 ? ' (an archived team is brought back first)' : ''}. A group with teams in it can’t be deleted.</p>
        </KitDialog>
      )}
      {deleting && totalOf(teamCounts.get(deleting.id)) === 0 && (
        <KitDialog
          kind="question"
          title={`Delete the ${deleting.name} group?`}
          onClose={() => setDeleting(null)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setDeleting(null)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-danger" onClick={() => void remove(deleting)} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete group'}
              </button>
            </>
          }
        >
          <p>No team is in it. It leaves the board’s filter and every team’s group choices.</p>
        </KitDialog>
      )}
    </ClubSection>
  );
}
