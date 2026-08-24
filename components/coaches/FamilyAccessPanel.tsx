'use client';
import { useCallback, useEffect, useState } from 'react';
import { Link2, Eye, Users } from 'lucide-react';
import CoachCollapseSection from './CoachCollapseSection';
import styles from './FamilyAccessPanel.module.css';

/**
 * "Team family access" — the coach's whole control surface for Chunk D.
 *
 * One link out, one visibility setting, one queue in. It renders NOTHING when the team is
 * not on a premium portal: the API answers 404 for an unentitled team, and a panel that
 * drew itself and then failed would be a worse answer than not being there.
 *
 * Requests arrive as a quiet batched count on this page — the coach reads them when they
 * are already here, which is the "no new recurring coach input" rule applied to the one
 * feature that genuinely does need their attention.
 *
 * ⚠ IT WAS THE TOP CARD ON ROSTER UNTIL 2026-08-24 and is now a collapsed section BELOW the
 * roster (owner call). Three always-open rows above the list pushed the roster itself under
 * the fold on a laptop, which had a settings surface outranking the thing the page is named
 * after. The disclosure and its summary line are owned HERE rather than by the page, because
 * the counts that decide both — and decide whether it opens itself — are this component's.
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

  /**
   * The one line a coach reads without opening anything. Ordered by what would make them open
   * it: someone waiting beats a follower count beats whether a link exists at all.
   */
  const summary = requests.length > 0
    ? <span className={styles.badge}>{requests.length} waiting</span>
    : followers.length > 0
      ? `${followers.length} following`
      : hasLink ? 'Link active' : 'No link yet';

  return (
    /**
     * ⚠ COLLAPSED BY DEFAULT, EXCEPT WHEN SOMEONE IS WAITING (owner call, 2026-08-24).
     *
     * This is a settings surface — a coach mints a link once and changes visibility rarely — and
     * as an always-open card above the roster it pushed the actual roster under the fold. Below
     * the list and folded away, it costs one line until it is wanted.
     *
     * `defaultOpen` on a pending request is the load-bearing half. The queue deliberately lives
     * on a page the coach already visits rather than sending them a notification ("no new
     * recurring coach input"), so a fold that hid an approval would break the one thing this
     * panel genuinely needs attention for. Safe to read counts here: the component renders
     * nothing until its load resolves, so the first render already knows.
     *
     * ⚠⚠ BEING COLLAPSED MEANS `check:layout` CANNOT MEASURE WHAT IS INSIDE. The seeded fixture
     * has no pending requests, so a normal sweep sees the summary row and nothing else. That is
     * how a fold quietly becomes the place defects go to stop being found: the eight controls in
     * here had measured 34px at 361/390 since they were built, and collapsing the panel would have
     * retired those baseline entries without fixing anything. They were fixed instead (the phone
     * tap floor at the bottom of this component's stylesheet), **verified by forcing this section
     * open for one sweep**, and only then pruned from the baseline.
     *
     * Anything added in here owes the same: force it open, sweep it at 390, put it back.
     */
    <CoachCollapseSection
      sectionId="family-access"
      title="Team family access"
      meta={summary}
      defaultOpen={requests.length > 0}
    >
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
    </CoachCollapseSection>
  );
}
