'use client';
/**
 * THE NAME WINDOW — one field, its count, Cancel and a lime Save (Settings in both workspaces Session 2, drawing mark 19:
 * "built like the shipped Web address window: a title, a line naming who can change it, one field, Cancel and a lime Save.
 * No warning callout is needed, because a new name breaks no links").
 *
 * Opened by a Tournament plan's Settings & access › Name & address (the organization's name) and by a Premium coach's
 * Team settings › Organization (the team's name, which the workspace's follows). The caller saves: `save` resolves to
 * null on success, or the words of the refusal, shown in the window.
 */
import { useState } from 'react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { NAME_MAX } from '@/lib/workspace-identity';

export default function NameWindow({ title, identity, field, hint, saveLabel, cancelLabel, current, save, onClose }: {
  title: string;
  identity: string;
  field: string;
  hint: string;
  saveLabel: string;
  cancelLabel: string;
  /** The name today. */
  current: string;
  save: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = value.trim();
  const ready = next.length > 0 && next.length <= NAME_MAX && next !== current.trim();

  async function submit() {
    if (!ready || busy) return; // Enter in the field submits too — never twice while one save is on its way
    setBusy(true);
    setError('');
    const refused = await save(next);
    if (refused) {
      setError(refused);
      setBusy(false);
    }
    // On success the caller closes the window (or moves the page); `busy` stays on until it does.
  }

  return (
    <KitDialog
      kind="form"
      title={title}
      identity={identity}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void submit()} disabled={busy || !ready}>{saveLabel}</button>
        </>
      )}
    >
      <form className={ck.field} onSubmit={e => { e.preventDefault(); void submit(); }}>
        <label className={ck.label} htmlFor="name-window-field">{field}<span className={ck.required} aria-hidden>*</span></label>
        <input
          id="name-window-field"
          className={ck.input}
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          maxLength={NAME_MAX}
          required
          autoComplete="off"
        />
        <p className={ck.hint}>{hint} {value.length} / {NAME_MAX}</p>
        {error && <p className={ck.hint} role="alert" style={{ color: 'var(--danger-light)' }}>{error}</p>}
      </form>
    </KitDialog>
  );
}
