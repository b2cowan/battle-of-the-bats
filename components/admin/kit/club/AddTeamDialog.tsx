'use client';
/**
 * Rep Teams › Add team (Club Tier Stage 2, specimen 1: "Add team keeps the team-cap window Stage 1
 * built"). Creating ASKS (house rule 2026-09-24) — an explicit Add, in the kit's form window, which on
 * a phone fills the screen and covers the bar (the drawer-layers ruling). At the plan's team limit
 * the refusal opens the team-cap window OVER this form, so what was typed is still here to add once
 * the club has moved up a band.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import KitDialog from './KitDialog';
import type { TeamCapRefusal } from './TeamCapDialog';
import ck from './ClubKit.module.css';
import { repKit } from './RepKit';
import { OFFERED_SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';
import { TEAM_COLOUR_EXAMPLE } from '@/lib/club-board-view';
import type { OrgPlan, RepTeamGroup } from '@/lib/types';

const TeamCapDialog = dynamic(() => import('./TeamCapDialog'));

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function AddTeamDialog({
  orgSlug, org, isOwner, groups, defaultGroupId, onClose, onCreated,
}: {
  orgSlug: string;
  org: { slug: string; name: string; planId: OrgPlan; subscriptionPeriod?: 'monthly' | 'annual' };
  isOwner: boolean;
  groups: RepTeamGroup[];
  /** The group the board is filtered to, if any — a new team usually belongs where you are looking. */
  defaultGroupId: string | null;
  onClose: () => void;
  onCreated: (team: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [sport, setSport] = useState<string>(DEFAULT_SPORT);
  const [division, setDivision] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId ?? '');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [capRefusal, setCapRefusal] = useState<TeamCapRefusal | null>(null);

  const ready = name.trim().length > 0 && slug.trim().length > 0;

  async function add() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/teams?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), slug: slug.trim(), sport: sport || DEFAULT_SPORT,
          division: division.trim() || null, description: description.trim() || null,
          color: color.trim() || null, groupId: groupId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === 'team_limit_reached') { setCapRefusal(data as TeamCapRefusal); return; }
      if (!res.ok) { setError(data.error ?? 'The team could not be added. Please try again.'); return; }
      onCreated({ id: data.team?.id, name: name.trim() });
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <KitDialog
        kind="form"
        title="Add a team"
        onClose={onClose}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-lime" onClick={add} disabled={!ready || busy}>
              {busy ? 'Adding…' : 'Add team'}
            </button>
          </>
        }
      >
        {error && <p className={repKit.formError} role="alert">{error}</p>}
        <label className={ck.field}>
          <span className={ck.label}>Team name<span className={repKit.req} aria-hidden>*</span></span>
          <input
            className={ck.input}
            value={name}
            maxLength={100}
            placeholder="e.g. 13U AA"
            onChange={e => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }}
          />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Public address<span className={repKit.req} aria-hidden>*</span></span>
          <input
            className={ck.input}
            value={slug}
            onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
          />
          <span className={ck.hint}>{orgSlug}/teams/{slug || 'team-name'} · lowercase letters, numbers and hyphens.</span>
        </label>
        <div className={repKit.fieldGrid}>
          <label className={ck.field}>
            <span className={ck.label}>Sport</span>
            <select className={ck.select} value={sport} onChange={e => setSport(e.target.value)}>
              {OFFERED_SPORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>Division</span>
            <input className={ck.input} value={division} maxLength={30} placeholder="e.g. U13 Tier 1" onChange={e => setDivision(e.target.value)} />
          </label>
          {groups.length > 0 && (
            <label className={ck.field}>
              <span className={ck.label}>Group</span>
              <select className={ck.select} value={groupId} onChange={e => setGroupId(e.target.value)}>
                <option value="">No group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <label className={ck.field}>
            <span className={ck.label}>Colour</span>
            <span className={repKit.fieldRow}>
              <i className={repKit.colourSwatch} style={{ background: /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined }} aria-hidden />
              <input className={ck.input} value={color} maxLength={7} placeholder={TEAM_COLOUR_EXAMPLE} onChange={e => setColor(e.target.value)} />
            </span>
          </label>
        </div>
        <label className={ck.field}>
          <span className={ck.label}>Description</span>
          <textarea className={ck.textarea} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
      </KitDialog>

      {capRefusal && (
        <TeamCapDialog
          refusal={capRefusal}
          org={org}
          isOwner={isOwner}
          onClose={() => setCapRefusal(null)}
          onArchive={() => { setCapRefusal(null); onClose(); }}
          // Moved up a band: the form is still open with what was typed — press Add team again.
          onMoved={() => { setCapRefusal(null); setError(''); }}
        />
      )}
    </>
  );
}
