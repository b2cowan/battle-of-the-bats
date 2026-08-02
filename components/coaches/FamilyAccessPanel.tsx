'use client';
import { useCallback, useEffect, useState } from 'react';
import { Link2, Eye, Users } from 'lucide-react';
import styles from './FamilyAccessPanel.module.css';

/**
 * "Team family access" (S5, top card) — the coach's whole control surface for Chunk D.
 *
 * One link out, one visibility setting, one queue in. It renders NOTHING when the team is
 * not on a premium portal: the API answers 404 for an unentitled team, and a panel that
 * drew itself and then failed would be a worse answer than not being there.
 *
 * Requests arrive as a quiet batched count on this page — the coach reads them when they
 * are already here, which is the "no new recurring coach input" rule applied to the one
 * feature that genuinely does need their attention.
 */

interface Follower {
  id: string;
  email: string;
  relationship: string | null;
  approvedAt: string | null;
}

interface Request {
  id: string;
  email: string;
  relationship: string | null;
  requestedAt: string;
}

type Visibility = 'staff' | 'families' | 'public_link';

const VISIBILITY_LABEL: Record<Visibility, string> = {
  staff: 'Staff only',
  families: 'Families',
  public_link: 'Public link',
};

const VISIBILITY_HELP: Record<Visibility, string> = {
  staff: 'Nobody outside your staff can see games or practices — connected families see a quiet “not available” message.',
  families: 'Connected families see the full schedule, games and practices. Individual game pages you share still work.',
  public_link: 'Anyone with your team’s public page can see the schedule, plus everything Families gets.',
};

export default function FamilyAccessPanel({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('families');
  const [hasLink, setHasLink] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFollowers, setShowFollowers] = useState(false);

  const base = `/api/coaches/${orgSlug}/teams/${teamId}/family-access`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(base);
      if (res.status === 404 || res.status === 403) { setAvailable(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      setVisibility(data.access.scheduleVisibility);
      setHasLink(data.access.hasFamilyLink);
      setFollowers(data.followers ?? []);
      setRequests(data.requests ?? []);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  async function mintLink() {
    setBusy('link'); setError(null);
    try {
      const res = await fetch(base, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error('Could not create the link.');
      setMintedUrl(data.url);
      setHasLink(true);
      // Best-effort convenience only — a clipboard the browser refuses still leaves the
      // link visible below to copy by hand.
      try { await navigator.clipboard.writeText(data.url); } catch { /* shown below instead */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link.');
    } finally {
      setBusy(null);
    }
  }

  async function changeVisibility(next: Visibility) {
    if (next === visibility) return;
    setBusy('visibility'); setError(null);
    const previous = visibility;
    setVisibility(next);
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleVisibility: next }),
      });
      if (!res.ok) throw new Error('Could not change who can see the schedule.');
    } catch (e) {
      setVisibility(previous);
      setError(e instanceof Error ? e.message : 'Could not change who can see the schedule.');
    } finally {
      setBusy(null);
    }
  }

  async function decide(linkId: string, action: 'approve' | 'decline' | 'revoke') {
    setBusy(linkId); setError(null);
    try {
      const res = await fetch(`${base}/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'That didn’t go through.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t go through.');
    } finally {
      setBusy(null);
    }
  }

  // Not a premium team (or no permission for family contacts) — render nothing at all.
  if (!available) return null;
  if (loading) return null;

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>Team family access</h2>

      {/* ── The link ── */}
      <div className={styles.row}>
        <Link2 size={16} aria-hidden />
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>Family link</div>
          <div className={styles.rowSub}>
            Share it with your team’s families — anyone with it can ask to follow the team, and you
            approve every request.
          </div>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={mintLink} disabled={busy === 'link'}>
          {busy === 'link' ? 'Working…' : hasLink ? 'Reset link' : 'Create link'}
        </button>
      </div>
      {hasLink && !mintedUrl && (
        <p className={styles.muted}>
          A link is active. Resetting creates a new one and immediately stops the old one working
          everywhere it has been shared.
        </p>
      )}
      {mintedUrl && (
        <>
          <p className={styles.muted}>Copied. This is the only time it’s shown — paste it into your team’s chat or email.</p>
          <div className={styles.linkOut}>{mintedUrl}</div>
        </>
      )}

      <div className={styles.divider} />

      {/* ── Visibility ── */}
      <div className={styles.row}>
        <Eye size={16} aria-hidden />
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>Schedule visibility</div>
          <div className={styles.rowSub}>{VISIBILITY_HELP[visibility]}</div>
        </div>
        <div className={styles.seg} role="group" aria-label="Who can see games and practices">
          {(['staff', 'families', 'public_link'] as Visibility[]).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={visibility === v}
              className={`${styles.segBtn}${visibility === v ? ' ' + styles.segBtnActive : ''}`}
              onClick={() => changeVisibility(v)}
              disabled={busy === 'visibility'}
            >
              {VISIBILITY_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Followers + the queue ── */}
      <div className={styles.row}>
        <Users size={16} aria-hidden />
        <div className={styles.rowMain}>
          <div className={styles.rowLabel}>
            Family followers · {followers.length}
            {requests.length > 0 && (
              <span className={styles.badge}>{requests.length} waiting</span>
            )}
          </div>
          <div className={styles.rowSub}>
            Grandparents and relatives following the team — not tied to any player.
          </div>
        </div>
        {followers.length > 0 && (
          <button type="button" className={styles.linkBtn} onClick={() => setShowFollowers(v => !v)}>
            {showFollowers ? 'Hide' : 'Manage'}
          </button>
        )}
      </div>

      {requests.map(r => (
        <div key={r.id} className={styles.request}>
          <span className={styles.requestWho}>
            {r.email} wants to follow the team{r.relationship ? ` · “${r.relationship}”` : ''}
          </span>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => decide(r.id, 'approve')} disabled={busy === r.id}>
            Approve
          </button>
          <button type="button" className={styles.linkBtn} onClick={() => decide(r.id, 'decline')} disabled={busy === r.id}>
            Decline
          </button>
        </div>
      ))}

      {showFollowers && followers.map(f => (
        <div key={f.id} className={styles.follower}>
          <span className={styles.followerWho}>
            {f.email}{f.relationship ? ` · ${f.relationship}` : ''}
          </span>
          <button type="button" className={styles.linkBtn} onClick={() => decide(f.id, 'revoke')} disabled={busy === f.id}>
            Remove
          </button>
        </div>
      ))}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
