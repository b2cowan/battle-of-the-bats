'use client';
/**
 * The club screens' one notice line — what just happened, said once (Club Tier Stage 1, screens
 * session). A success says itself and goes (the portal's transient-word ruling: "Saved" fades, only
 * an error persists); a failure stays until it is read, and is announced as an alert. A seat-limit
 * refusal carries its way out as a link ("See plans").
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import ck from './ClubKit.module.css';

export type Notice = { tone: 'good' | 'bad'; text: string; link?: { href: string; label: string } };

const FADE_MS = 8000;

/** A page's notice, with the success fading on its own. */
export function useNotice(initial: Notice | null | (() => Notice | null) = null) {
  const [notice, setNotice] = useState<Notice | null>(initial);
  useEffect(() => {
    if (notice?.tone !== 'good') return;
    const t = window.setTimeout(() => setNotice(null), FADE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);
  return [notice, setNotice] as const;
}

/** A server refusal as a notice; a seat-limit one offers the owner the way out, Plan & billing. */
export function refusalNotice(refusal: { text: string; seat?: boolean }, billingHref?: string | null): Notice {
  return {
    tone: 'bad',
    text: refusal.text,
    link: refusal.seat && billingHref ? { href: billingHref, label: 'See plans' } : undefined,
  };
}

export default function PageNotice({ notice }: { notice: Notice }) {
  return (
    <div className={`${ck.notice} ${notice.tone === 'good' ? ck.noticeGood : ck.noticeBad}`} role={notice.tone === 'bad' ? 'alert' : 'status'}>
      {notice.tone === 'good' ? <CheckCircle2 size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
      <div className={ck.noticeBody}>
        {notice.text}
        {notice.link && <> <Link href={notice.link.href} className={ck.link}>{notice.link.label}</Link></>}
      </div>
    </div>
  );
}
