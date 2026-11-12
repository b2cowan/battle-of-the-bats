'use client';
/**
 * THE OVERVIEW'S TWO-STEP NOTICE (Board Ready · two-step sign-in, Part 4; drawings tab 8; asks 1 and F; owner ruling
 * 2026-11-12: ONE notice spot under the bar, two-step first, then the What's-new line).
 *
 *   - The OWNER, once: "Your club can require two-step sign-in for the board." Open Settings or the × closes it for good
 *     (so does opening Settings, or turning a requirement on).
 *   - Owners and admins, while a requirement is on: "N people still need to set up two-step sign-in." with the first names
 *     and the soonest deadline, and Open Members. No ×: it leaves when the last person sets it up.
 *
 * The portal's own one-line notice look (`ck.notice`, as the What's-new line), so the spot never changes shape. Until the
 * read answers, nothing shows in the spot (the What's-new line waits too, so it never appears and is then replaced).
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import ck from './ClubKit.module.css';

type Overview = {
  prompt: boolean;
  waiting: { count: number; people: { name: string; role: string; deadline: string; overdue: boolean }[] } | null;
};

function namesLine(w: NonNullable<Overview['waiting']>): string {
  const shown = w.people.map(p => (w.count === 1 ? `${p.name} (${p.role.toLowerCase()})` : p.name));
  const others = w.count - shown.length;
  const list = others > 0
    ? `${shown.join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`
    : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? '';
  const first = w.people[0];
  if (!first) return '';
  const day = formatStoredDate(first.deadline, { withYear: false });
  const whose = w.count === 1 ? 'Their deadline' : 'The first deadline';
  return `${list}. ${whose} ${first.overdue ? `passed on ${day}` : `is ${day}`}.`;
}

export default function TwoStepOverviewNotice({
  slug, base, noun, canSee, fallback,
}: {
  slug: string;
  /** The admin portal's base path (`/{slug}/admin`). */
  base: string;
  /** "club", "league" or "organization". */
  noun: string;
  /** The viewer is the owner or an admin. */
  canSee: boolean;
  /** What the spot shows when there is no two-step notice (the What's-new line). */
  fallback: ReactNode;
}) {
  const [data, setData] = useState<Overview | null | 'none'>(canSee ? null : 'none');
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!canSee || !slug) { setData('none'); return; }
    let stale = false;
    fetch(`/api/admin/org-settings/two-step/overview?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!stale) setData(d ? (d as Overview) : 'none'); })
      .catch(() => { if (!stale) setData('none'); });
    return () => { stale = true; };
  }, [canSee, slug]);

  const close = () => {
    setClosed(true);
    void fetch(`/api/admin/org-settings/two-step/overview?orgSlug=${encodeURIComponent(slug)}`, { method: 'POST' }).catch(() => {});
  };

  if (data === null) return null;
  if (data === 'none' || closed) return <>{fallback}</>;

  if (data.waiting) {
    const n = data.waiting.count;
    return (
      <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
        <ShieldCheck size={14} aria-hidden />
        <span className={ck.noticeBody}>
          <strong>{n} {n === 1 ? 'person still needs' : 'people still need'} to set up two-step sign-in.</strong>{' '}
          {namesLine(data.waiting)}{' '}
          <Link className={ck.noticeLink} href={`${base}/org/members`}>Open Members ›</Link>
        </span>
      </div>
    );
  }

  if (data.prompt) {
    return (
      <div className={ck.notice} role="status">
        <ShieldCheck size={14} aria-hidden />
        <span className={ck.noticeBody}>
          <strong>Your {noun} can require two-step sign-in for the board.</strong>{' '}
          It stops a stolen password from opening your books and families’ details. Nothing changes unless you turn it on.{' '}
          <Link className={ck.noticeLink} href={`${base}/org/settings`} onClick={close}>Open Settings ›</Link>
        </span>
        <button type="button" className={ck.noticeDismiss} aria-label="Close the two-step sign-in note" onClick={close}>
          <X size={14} aria-hidden />
        </button>
      </div>
    );
  }

  return <>{fallback}</>;
}
