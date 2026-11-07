'use client';
/**
 * The Overview's "What's new" note (owner 2026-11-07, `docs/projects/active/WHATS_NEW_HOME_PLAN.md`): ONE quiet line under
 * the page title while a release the owner chose to ANNOUNCE is unread on this device. It is the portal's own one-line
 * notice look (`ck.notice`) plus an X. The X, or opening What's new, clears it here and the "New" tag in the account menu
 * (one per-device marker). A release that was not announced never shows it. Nothing renders on the server or before
 * hydration, so the morning cards are never delayed by it; when it does appear they move down one line, once.
 */
import { Sparkles, X } from 'lucide-react';
import { LATEST_ANNOUNCED } from '@/lib/release-announcements';
import { markReleasesSeen, useReleaseUnread } from '@/components/whats-new/release-seen';
import ck from './ClubKit.module.css';

export default function WhatsNewNote() {
  const unread = useReleaseUnread();
  if (!unread || !LATEST_ANNOUNCED) return null;
  return (
    <div className={ck.notice} role="status">
      <Sparkles size={14} aria-hidden />
      <span className={ck.noticeBody}>
        {LATEST_ANNOUNCED.line}{' '}
        {/* Cleared a beat after the click: removing this link in the same tick can cancel its new tab in some browsers. */}
        <a className={ck.noticeLink} href="/changelog" target="_blank" rel="noopener noreferrer" onClick={() => { window.setTimeout(markReleasesSeen); }}>
          What’s new ›
        </a>
      </span>
      <button type="button" className={ck.noticeDismiss} aria-label="Dismiss the what’s new note" onClick={markReleasesSeen}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
